"""
CT Scan AI Inference API
========================
A clean, async API for running AI inference on medical CT scans.
"""

import io
import os
import tempfile
import zipfile
from pathlib import Path

import nibabel as nib
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from utils.suprem_engine import SuPreMEngine, ORGAN_NAMES

# ---------------------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CT Inference API",
    description="Run AI-powered analysis on CT scans",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
RESULT_DIR = BASE_DIR / "results"
MODEL_DIR = BASE_DIR / "models"
CHECKPOINT_DIR = BASE_DIR.parent / "SuPreM" / "direct_inference" / "pretrained_checkpoints"

UPLOAD_DIR.mkdir(exist_ok=True)
RESULT_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Inference Engine (loaded once at startup)
# ---------------------------------------------------------------------------

engine: SuPreMEngine | None = None


@app.on_event("startup")
async def load_model():
    global engine
    checkpoint_path = CHECKPOINT_DIR / "supervised_suprem_unet_2100.pth"
    if checkpoint_path.exists():
        engine = SuPreMEngine(str(checkpoint_path))
        print(f"[OK] SuPreM model loaded: {checkpoint_path.name}")
    else:
        print("[WARN] No checkpoint found — running in demo mode")


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": engine is not None and not engine.demo_mode,
        "model_type": "SuPreM-UNet" if engine and not engine.demo_mode else "demo",
    }


# ---------------------------------------------------------------------------
# Volume Data Endpoint (for 3D rendering)
# ---------------------------------------------------------------------------


@app.get("/api/volume/{case_name}")
async def get_volume_data(case_name: str):
    """Return CT volume and mask as .npy files for 3D rendering."""
    case_result_dir = RESULT_DIR / case_name
    volume_path = case_result_dir / "volume.npy"
    mask_path = case_result_dir / "mask.npy"

    if not volume_path.exists() or not mask_path.exists():
        raise HTTPException(404, "Volume data not found. Run inference first.")

    volume = np.load(str(volume_path))
    mask = np.load(str(mask_path))

    # Save as a combined .npz file for efficient transfer
    buf = io.BytesIO()
    np.savez_compressed(buf, volume=volume, mask=mask)
    buf.seek(0)

    return StreamingResponse(
        iter([buf.read()]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={case_name}_volume.npz"},
    )


# ---------------------------------------------------------------------------
# Mesh Data Endpoint
# ---------------------------------------------------------------------------


@app.get("/api/mesh/{case_name}")
async def get_mesh_data(case_name: str):
    """Return 3D meshes of segmented organs."""
    case_result_dir = RESULT_DIR / case_name
    mask_path = case_result_dir / "mask.npy"
    spacing_path = case_result_dir / "spacing.npy"
    meshes_dir = case_result_dir / "meshes"
    cached_mesh_path = meshes_dir / "meshes.npz"

    if not mask_path.exists():
        raise HTTPException(404, "Mask data not found. Run inference first.")

    # Check for cached meshes
    if cached_mesh_path.exists():
        # Verify cache has metadata (added in v2)
        try:
            with np.load(str(cached_mesh_path), allow_pickle=False) as data:
                if '_meta_spacing' not in data:
                    # Old cache format without metadata, regenerate
                    pass
                else:
                    buf = io.BytesIO(cached_mesh_path.read_bytes())
                    buf.seek(0)
                    return StreamingResponse(
                        iter([buf.read()]),
                        media_type="application/octet-stream",
                        headers={"Content-Disposition": f"attachment; filename={case_name}_meshes.npz"},
                    )
        except Exception:
            pass  # Corrupted cache, regenerate

    mask = np.load(str(mask_path))
    
    # Try to load spacing
    if spacing_path.exists():
        spacing = tuple(np.load(str(spacing_path)).tolist())
    else:
        # Fallback to combined_labels.nii.gz
        combined_path = case_result_dir / "combined_labels.nii.gz"
        if combined_path.exists():
            nii = nib.load(str(combined_path))
            spacing = tuple(map(float, nii.header.get_zooms()[:3]))
        else:
            spacing = (1.0, 1.0, 1.0)
            
    from utils.mesh_generator import generate_organ_meshes, compute_volume_metadata
    meshes = generate_organ_meshes(mask, spacing)
    
    # Compute volume metadata for frontend slice plane positioning
    metadata = compute_volume_metadata(mask, spacing)
    
    # Save cache and return
    meshes_dir.mkdir(exist_ok=True)
    
    save_dict = {}
    organ_names = list(meshes.keys())
    save_dict["organ_names"] = np.array(organ_names, dtype=str)
    
    if metadata:
        save_dict["_meta_spacing"] = metadata["spacing"]
        save_dict["_meta_volume_shape"] = metadata["volume_shape"]
        save_dict["_meta_global_center"] = metadata["global_center"]
    
    for organ_name, data in meshes.items():
        save_dict[f"{organ_name}_vertices"] = data["vertices"]
        save_dict[f"{organ_name}_faces"] = data["faces"]
        save_dict[f"{organ_name}_normals"] = data["normals"]
        
    np.savez_compressed(str(cached_mesh_path), **save_dict)
    
    buf = io.BytesIO(cached_mesh_path.read_bytes())
    buf.seek(0)
    
    return StreamingResponse(
        iter([buf.read()]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={case_name}_meshes.npz"},
    )


# ---------------------------------------------------------------------------
# CT Slice Endpoint (for 3D slice plane texture)
# ---------------------------------------------------------------------------


@app.get("/api/ct-slice/{case_name}/{slice_index}")
async def get_ct_slice(case_name: str, slice_index: int):
    """Return a single CT slice as a grayscale PNG for 3D slice plane texture."""
    volume_path = RESULT_DIR / case_name / "volume.npy"
    if not volume_path.exists():
        raise HTTPException(404, "Volume data not found. Run inference first.")

    volume = np.load(str(volume_path))
    max_slice = volume.shape[2] - 1

    if slice_index < 0 or slice_index > max_slice:
        raise HTTPException(
            400, f"Slice index {slice_index} out of range (0-{max_slice})"
        )

    ct_slice = volume[:, :, slice_index]

    # Window to soft-tissue range and normalize to 0-255
    ct_display = np.clip(ct_slice, -175, 250)
    ct_display = ((ct_display - (-175)) / (250 - (-175)) * 255).astype(np.uint8)

    # Match 3D plane orientation: i (columns) corresponds to X, j (rows) corresponds to Y.
    # We transpose so i is columns, then flipud so j=0 is at the bottom.
    ct_oriented = np.flipud(ct_display.T)

    from PIL import Image
    img = Image.fromarray(ct_oriented, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/api/volume-info/{case_name}")
async def get_volume_info(case_name: str):
    """Return volume metadata (dimensions, spacing) for the 3D viewer."""
    case_result_dir = RESULT_DIR / case_name
    volume_path = case_result_dir / "volume.npy"
    spacing_path = case_result_dir / "spacing.npy"

    if not volume_path.exists():
        raise HTTPException(404, "Volume data not found. Run inference first.")

    volume = np.load(str(volume_path))
    
    if spacing_path.exists():
        spacing = np.load(str(spacing_path)).tolist()
    else:
        combined_path = case_result_dir / "combined_labels.nii.gz"
        if combined_path.exists():
            nii = nib.load(str(combined_path))
            spacing = list(map(float, nii.header.get_zooms()[:3]))
        else:
            spacing = [1.0, 1.0, 1.0]

    return {
        "volume_shape": list(volume.shape),
        "spacing": spacing[:3],
        "total_slices": int(volume.shape[2]),
    }


# ---------------------------------------------------------------------------
# Inference Endpoint
# ---------------------------------------------------------------------------


@app.post("/api/infer")
async def run_inference(file: UploadFile = File(...)):
    """
    Upload a CT scan (.nii.gz or .nii) and get AI predictions.

    Returns:
    - Per-organ segmentation masks (as base64 overlay images)
    - List of detected organs with names and IDs
    - Statistics (volume shape, detected organs, coverage)
    - Download URL for the segmentation results
    """

    # ── Validate file ────────────────────────────────────────────────
    allowed = (".nii", ".nii.gz")
    if not any(file.filename.endswith(ext) for ext in allowed):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Please upload {', '.join(allowed)} files.",
        )

    # ── Save to temp file ────────────────────────────────────────────
    tmp_path = UPLOAD_DIR / f"tmp_{file.filename}"
    try:
        contents = await file.read()
        tmp_path.write_bytes(contents)

        # ── Load CT volume ───────────────────────────────────────────
        nii = nib.load(str(tmp_path))
        volume = nii.get_fdata().astype(np.float32)
        spacing = list(map(float, nii.header.get_zooms()))

        # ── Run inference ────────────────────────────────────────────
        if engine is not None:
            result = engine.predict(volume)
            mask = result["mask"]
            organ_names = result["organ_names"]
            confidence = result["confidence"]
            num_organs = result["num_organs"]
        else:
            # Demo mode: simple threshold
            mask = (volume > 300).astype(np.uint8)
            organ_names = ["Bone (demo)"]
            confidence = 0.0
            num_organs = 1

        # ── Save results ─────────────────────────────────────────────
        case_name = file.filename.replace(".nii.gz", "").replace(".nii", "")
        case_result_dir = RESULT_DIR / case_name
        segmentations_dir = case_result_dir / "segmentations"
        segmentations_dir.mkdir(parents=True, exist_ok=True)

        # Save volume and mask as .npy for 3D rendering
        np.save(str(case_result_dir / "volume.npy"), volume.astype(np.float32))
        np.save(str(case_result_dir / "mask.npy"), mask.astype(np.uint8))
        np.save(str(case_result_dir / "spacing.npy"), np.array(spacing, dtype=np.float64))

        # Save combined labels
        combined_path = case_result_dir / "combined_labels.nii.gz"
        combined_nii = nib.Nifti1Image(mask.astype(np.uint8), nii.affine)
        nib.save(combined_nii, str(combined_path))

        # Save per-organ masks
        organ_files = []
        for organ_id in range(1, 33):
            organ_mask = (mask == organ_id).astype(np.uint8)
            if organ_mask.sum() > 0:
                organ_name = ORGAN_NAMES[organ_id - 1].lower().replace(" ", "_")
                organ_path = segmentations_dir / f"{organ_name}.nii.gz"
                organ_nii = nib.Nifti1Image(organ_mask, nii.affine)
                nib.save(organ_nii, str(organ_path))
                organ_files.append({
                    "name": ORGAN_NAMES[organ_id - 1],
                    "filename": f"{organ_name}.nii.gz",
                    "voxels": int(organ_mask.sum()),
                })

        # ── Generate visualizations ──────────────────────────────────
        from utils.visualizer import generate_multi_organ_overlay
        viz = generate_multi_organ_overlay(volume, mask, num_slices=10)

        # ── Compute statistics ───────────────────────────────────────
        stats = {
            "volume_shape": list(volume.shape),
            "voxel_spacing_mm": spacing,
            "detected_organs": num_organs,
            "total_voxels": int(volume.size),
            "organ_voxels": int((mask > 0).sum()),
            "coverage_pct": round(float((mask > 0).sum() / mask.size * 100), 2),
            "hu_range": [float(volume.min()), float(volume.max())],
        }

        return {
            "status": "success",
            "filename": file.filename,
            "detected_organs": organ_names,
            "organ_files": organ_files,
            "statistics": stats,
            "ct_images": viz["ct_images"],
            "organ_overlays": viz["organ_overlays"],
            "organ_ids": viz["organ_ids"],
            "download_url": f"/api/download/{case_name}",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Download Endpoint
# ---------------------------------------------------------------------------


@app.get("/api/download/{case_name}")
async def download_results(case_name: str):
    """Download all segmentation results as a zip file."""
    case_result_dir = RESULT_DIR / case_name
    if not case_result_dir.exists():
        raise HTTPException(404, "Results not found. Run inference first.")

    # Create zip file
    zip_path = RESULT_DIR / f"{case_name}_segmentations.zip"
    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
        # Add combined labels
        combined = case_result_dir / "combined_labels.nii.gz"
        if combined.exists():
            zf.write(str(combined), "combined_labels.nii.gz")

        # Add per-organ masks
        seg_dir = case_result_dir / "segmentations"
        if seg_dir.exists():
            for organ_file in seg_dir.glob("*.nii.gz"):
                zf.write(str(organ_file), f"segmentations/{organ_file.name}")

    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename=f"{case_name}_segmentations.zip",
    )


@app.get("/api/download/{case_name}/{organ_name}")
async def download_organ_mask(case_name: str, organ_name: str):
    """Download a single organ's segmentation mask."""
    mask_path = RESULT_DIR / case_name / "segmentations" / f"{organ_name}.nii.gz"
    if not mask_path.exists():
        raise HTTPException(404, f"Organ mask not found: {organ_name}")
    return FileResponse(
        str(mask_path),
        media_type="application/gzip",
        filename=f"{organ_name}.nii.gz",
    )


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
