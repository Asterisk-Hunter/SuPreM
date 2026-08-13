# CT Scan AI Inference

A web application for multi-organ segmentation of abdominal CT scans using the SuPreM model.

Upload a `.nii.gz` CT scan, run inference, view colored organ overlays slice-by-slice, and download per-organ segmentation masks.

## Architecture

```
Frontend (Next.js 16)  →  Backend (FastAPI)  →  SuPreM Model (PyTorch)
        ↓                       ↓                       ↓
   Upload CT              Parse NIfTI           Sliding window inference
   Slice viewer           Preprocess HU          9-organ segmentation
   Organ overlays         Postprocess            Return masks
```

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt

# Download the SuPreM checkpoint (222MB)
# Place at: SuPreM/direct_inference/pretrained_checkpoints/supervised_suprem_unet_2100.pth

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and upload a CT scan.

## Project Structure

```
ct-inference-app/
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── utils/
│   │   ├── suprem_engine.py     # SuPreM model loading & inference
│   │   └── visualizer.py        # Multi-organ overlay generation
│   ├── requirements.txt
│   └── test_inference.py        # Inference test script
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # CT workspace page
│   │   ├── globals.css          # Material Design 3 theme tokens
│   │   └── layout.tsx           # Root layout
│   ├── components/
│   │   ├── FileUpload.tsx       # Drag-and-drop upload
│   │   ├── SliceViewer.tsx      # CT slice viewer with film strip
│   │   ├── StatsPanel.tsx       # Detected organs & coverage stats
│   │   ├── Sidebar.tsx          # Navigation rail
│   │   └── TopBar.tsx           # Workspace header
│   ├── lib/
│   │   └── api.ts               # API client & TypeScript types
│   └── package.json
├── SuPreM/                      # SuPreM model source (ICLR 2024)
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check, model status |
| `POST` | `/api/infer` | Upload CT scan, run inference |
| `GET` | `/api/download/{case}` | Download all masks as zip |
| `GET` | `/api/download/{case}/{organ}` | Download single organ mask |

## Model

Uses [SuPreM](https://github.com/MrGiovanni/SuPreM) (Supervised Pre-trained Models, ICLR 2024) with a UNet3D backbone trained on AbdomenAtlas 1.1 (2100 CTs).

**Supported organs:**
Spleen, Right Kidney, Left Kidney, Gall Bladder, Liver, Stomach, Aorta, Postcava, Pancreas

**Inference pipeline:**
1. Load NIfTI file, clip HU values to [-175, 250]
2. Normalize to [0, 1], reshape to [1, 1, D, H, W]
3. Sliding window inference (96x96x96 ROI, 0.75 overlap, Gaussian blending)
4. Sigmoid thresholding at 0.5, connected component filtering
5. Save per-organ masks and combined label map

## Supported Formats

- NIfTI (`.nii`, `.nii.gz`)

## Requirements

- Python 3.13+
- PyTorch 2.8+ with CUDA
- MONAI 1.6+
- Node.js 18+
