"""
CT Scan AI Inference API
========================
A clean, async API for running AI inference on medical CT scans.
"""

import os
import tempfile
import zipfile
from pathlib import Path

import nibabel as nib
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

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
        slices = generate_multi_organ_overlay(volume, mask, num_slices=10)

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
            "slice_images": slices,
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
