import sys
sys.path.insert(0, r'C:\Data\think\ct-inference-app\backend')
import numpy as np
import nibabel as nib

from utils.suprem_engine import SuPreMEngine, ORGAN_NAMES

# Load the test CT scan
ct_path = r'C:\Data\think\ct-inference-app\BDMAP_00000338\ct.nii.gz'
nii = nib.load(ct_path)
volume = nii.get_fdata().astype(np.float32)
print(f'CT shape: {volume.shape}')

# Load engine
checkpoint = r'C:\Data\think\ct-inference-app\SuPreM\direct_inference\pretrained_checkpoints\supervised_suprem_unet_2100.pth'
engine = SuPreMEngine(checkpoint)

# Run inference
print('Running inference...')
result = engine.predict(volume)

print(f'Detected organs ({result["num_organs"]}): {result["organ_names"]}')
print(f'Confidence: {result["confidence"]:.4f}')
print(f'Label map shape: {result["mask"].shape}')
print(f'Unique labels: {np.unique(result["mask"])}')

# Compare with ground truth
gt_dir = r'C:\Data\think\ct-inference-app\BDMAP_00000338\segmentations'
import os
print(f'\nGround truth organs: {sorted(os.listdir(gt_dir))}')

# Show per-organ voxel counts
for name, mask in result['per_organ_masks'].items():
    voxels = int(mask.sum())
    if voxels > 0:
        print(f'  {name}: {voxels} voxels')
