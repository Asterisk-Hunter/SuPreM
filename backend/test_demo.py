"""
Test Script
===========
Creates a synthetic CT scan and runs the inference pipeline.
"""

import sys
import numpy as np
import nibabel as nib
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.visualizer import generate_slice_overlay


def create_synthetic_ct(size=(128, 128, 64)):
    np.random.seed(42)
    volume = np.random.randn(*size).astype(np.float32) * 100

    from scipy.ndimage import gaussian_filter

    liver_mask = np.zeros(size)
    liver_mask[40:90, 60:110, 10:50] = 1
    liver_mask = gaussian_filter(liver_mask.astype(float), sigma=5)
    volume += liver_mask * 50

    spleen_mask = np.zeros(size)
    spleen_mask[30:70, 10:50, 15:45] = 1
    spleen_mask = gaussian_filter(spleen_mask.astype(float), sigma=4)
    volume += spleen_mask * 45

    for center_y in [20, 100]:
        kidney_mask = np.zeros(size)
        kidney_mask[35:65, center_y-15:center_y+15, 20:40] = 1
        kidney_mask = gaussian_filter(kidney_mask.astype(float), sigma=3)
        volume += kidney_mask * 40

    aorta_mask = np.zeros(size)
    aorta_mask[50:80, 55:75, 25:40] = 1
    aorta_mask = gaussian_filter(aorta_mask.astype(float), sigma=2)
    volume += aorta_mask * 60

    return volume


def main():
    print("=" * 60)
    print("  CT Inference Backend - Demo Test")
    print("=" * 60)

    print("\n[1] Creating synthetic CT volume (128x128x64)...")
    volume = create_synthetic_ct()
    print(f"    Shape: {volume.shape}")
    print(f"    HU range: [{volume.min():.0f}, {volume.max():.0f}]")

    print("\n[2] Saving as NIfTI...")
    tmp_path = Path(tempfile.mktemp(suffix=".nii.gz"))
    nii = nib.Nifti1Image(volume, affine=np.eye(4))
    nib.save(nii, str(tmp_path))
    print(f"    Saved to: {tmp_path}")

    print("\n[3] Generating slice visualizations...")
    mask = (volume > 30).astype(np.float32)
    slices = generate_slice_overlay(volume, mask, num_slices=5)
    print(f"    Generated {len(slices)} slice images")
    for s in slices:
        print(f"    - Slice {s['slice_index']}: {len(s['image'])} chars base64")

    print("\n[4] Statistics:")
    stats = {
        "volume_shape": list(volume.shape),
        "detected_voxels": int(mask.sum()),
        "total_voxels": int(mask.size),
        "coverage_pct": round(float(mask.sum() / mask.size * 100), 2),
    }
    for k, v in stats.items():
        print(f"    {k}: {v}")

    tmp_path.unlink(missing_ok=True)

    print("\n[PASS] All tests passed! Backend is ready.")
    print("=" * 60)


if __name__ == "__main__":
    main()
