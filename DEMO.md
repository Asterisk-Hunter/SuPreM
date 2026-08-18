# SuPreM CT Organ Segmentation Platform

## Problem Statement

Manual segmentation of organs in CT scans is time-consuming and subjective. A single abdominal CT can contain 200+ slices, and radiologists must identify and outline each organ manually. This project automates multi-organ segmentation using deep learning.

---

## Solution

A web-based platform that takes a CT scan (NIfTI format), runs the SuPreM AI model, and produces segmentation masks for 9 abdominal organs with interactive visualization and export.

---

## Model: SuPreM

**SuPreM** (Supervised Pre-trained Models) is a medical image segmentation framework from Johns Hopkins University, published at ICLR 2024 (Oral Presentation).

**Architecture:**
- Backbone: UNet3D (~19M parameters)
- Training data: AbdomenAtlas 1.1 (2,100 CT scans with expert annotations)
- Inference: Sliding window approach (96x96x96 voxels, 75% overlap, Gaussian blending)

**Supported Organs:**
| Organ | Description |
|-------|-------------|
| Spleen | Upper left abdomen |
| Right Kidney | Retroperitoneal, right side |
| Left Kidney | Retroperitoneal, left side |
| Gall Bladder | Beneath the liver |
| Liver | Upper right abdomen |
| Stomach | Upper left abdomen |
| Aorta | Major artery |
| Postcava | Inferior vena cava |
| Pancreas | Behind the stomach |

---

## System Architecture

```
[Browser]                    [FastAPI Backend]              [SuPreM Model]
    |                              |                              |
    |--- Upload CT scan --------->|                              |
    |                              |--- Load NIfTI volume ------>|
    |                              |--- Preprocess (HU clip,     |
    |                              |    normalize, reshape) ---->|
    |                              |--- Sliding window --------->|
    |                              |    inference (GPU)           |
    |                              |<-- Probability maps --------|
    |                              |--- Threshold + postprocess   |
    |                              |--- Generate overlays         |
    |                              |--- Save per-organ masks      |
    |<-- Results + images ---------|                              |
    |                              |                              |
    |--- Download masks --------->|--- Return .nii.gz files --->|
```

**Tech Stack:**
- Frontend: Next.js 16, React, Tailwind CSS, TypeScript
- Backend: FastAPI, Python 3.13
- AI: PyTorch 2.8 (CUDA), MONAI 1.6
- Model: SuPreM UNet3D (pretrained on AbdomenAtlas 1.1)

---

## Key Features

### 1. CT Scan Upload
- Drag-and-drop or click to browse
- Supports .nii and .nii.gz (NIfTI) format
- Progress bar with step-by-step status during inference

### 2. AI-Powered Segmentation
- 9-organ segmentation in ~45 seconds
- 99.99% confidence on test data
- Automatic post-processing (connected component analysis, size filtering)

### 3. 2D Slice Viewer
- Scroll through CT slices
- Colored organ overlays (each organ has a distinct color)
- Film strip for quick navigation

### 4. Results Dashboard
- List of detected organs with voxel counts
- Coverage percentage (organs vs total volume)
- Volume dimensions and spacing info

### 5. Export
- Download individual organ masks (.nii.gz)
- Download all masks as a zip file
- Compatible with 3D Slicer, ITK-SNAP, and other medical imaging tools

---

## Inference Pipeline

```
Input CT Volume (502 x 348 x 71 voxels)
        |
        v
[1] HU Clipping: clip values to [-175, 250]
    (remains air, dense bone outside useful range)
        |
        v
[2] Normalization: scale to [0, 1]
    (neural networks work best with small values)
        |
        v
[3] Reshape: [1, 1, D, H, W]
    (add batch + channel dimensions for model)
        |
        v
[4] Sliding Window Inference
    - ROI: 96 x 96 x 96 voxels
    - Overlap: 75%
    - Blending: Gaussian weighting
    - Device: CUDA GPU
        |
        v
[5] Post-processing
    - Sigmoid activation
    - Threshold at 0.5
    - Connected component analysis
    - Size filtering
        |
        v
Output: 9 binary masks + combined label map
```

---

## Performance

| Metric | Value |
|--------|-------|
| Test CT Size | 502 x 348 x 71 voxels |
| Voxel Spacing | 0.816 x 0.816 x 2.5 mm |
| Inference Time | ~45 seconds |
| Detected Organs | 9/9 |
| Confidence | 99.99% |
| Model Size | 222 MB |
| GPU Memory | ~4 GB |

---

## Demo Walkthrough

### Step 1: Upload
- User drags a .nii.gz CT scan onto the upload area
- Frontend sends file to backend API

### Step 2: Processing
- Progress bar shows: Loading CT volume -> Preprocessing -> Running AI inference -> Generating visualizations -> Preparing results
- Backend processes the scan through the SuPreM pipeline

### Step 3: Results
- CT viewer displays slices with colored organ overlays
- Right panel shows detected organs, coverage stats
- User can scroll through slices to inspect segmentation quality

### Step 4: Export
- User clicks "Download All Masks" to get a zip file
- Zip contains individual .nii.gz files for each organ
- Files can be opened in 3D Slicer for further analysis

---

## Comparison with Existing Tools

| Feature | This Platform | TotalSegmentator | 3D Slicer |
|---------|---------------|------------------|-----------|
| Web-based | Yes | Yes | No (desktop) |
| Setup complexity | Low | Medium | High |
| Organ count | 9 | 100+ | Manual |
| AI model | SuPreM | nnU-Net | None |
| Export format | NIfTI | NIfTI | Multiple |
| Real-time preview | Yes | No | Yes |

---

## Future Work

1. **3D Volume Rendering** - Interactive 3D visualization of organ masks using Three.js or Cornerstone3D
2. **Organ Toggle** - Show/hide individual organ overlays in the viewer
3. **DICOM Support** - Direct upload of DICOM series
4. **Batch Processing** - Process multiple scans in parallel
5. **Report Generation** - Automated clinical reports with findings

---

## Technical Challenges Solved

1. **Import Collision** - SuPreM's `utils/` conflicted with backend's `utils/`. Solved using `importlib.util.spec_from_file_location` with path manipulation.

2. **MONAI Version** - Original SuPreM required MONAI 0.9.0 (incompatible with Python 3.13). Upgraded to MONAI 1.6.0 with minor API adjustments.

3. **Overlay Rendering** - Matplotlib's `.T` transpose on RGBA arrays produced wrong shapes. Fixed with `np.transpose(overlay, (1, 0, 2))` to only swap spatial axes.

4. **Windows Console Encoding** - Emoji in print statements caused encoding errors on Windows. Removed all emoji from backend output.

---

## Project Structure

```
ct-inference-app/
├── backend/
│   ├── main.py                  # FastAPI application
│   ├── utils/
│   │   ├── suprem_engine.py     # SuPreM model wrapper
│   │   └── visualizer.py        # Overlay generation
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Main workspace
│   │   └── globals.css          # Material Design 3 tokens
│   ├── components/
│   │   ├── FileUpload.tsx       # Drag-drop upload
│   │   ├── SliceViewer.tsx      # CT slice viewer
│   │   └── StatsPanel.tsx       # Results display
│   └── lib/
│       └── api.ts               # API client
├── SuPreM/                      # Model source code
└── README.md
```

---

## Conclusion

This platform demonstrates how modern deep learning models can be deployed as accessible web applications for medical imaging. By combining SuPreM's state-of-the-art segmentation with a clean, intuitive interface, we make AI-powered organ segmentation available to clinicians without requiring technical expertise or complex software installation.
