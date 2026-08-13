# CT Inference App - Handoff Document

## Project Overview

A web app for multi-organ segmentation of abdominal CT scans. Upload `.nii.gz` → SuPreM model inference → colored organ overlays → download masks.

**Live at:** `http://localhost:3000` (frontend) / `http://localhost:8000` (backend)

**Repo:** `https://github.com/Asterisk-Hunter/SuPreM.git`

---

## What's Working

- **Backend:** FastAPI, SuPreM model loads on CUDA, detects 9 organs at 99.99% confidence
- **Frontend:** Next.js 16 + Tailwind v4, clean Material Design 3 light theme
- **Inference:** Upload `.nii.gz` → preprocessing → sliding window inference → per-organ masks + combined labels
- **2D Viewer:** Slice-by-slice CT viewer with film strip, colored organ overlays
- **Download:** Per-organ `.nii.gz` files + combined zip
- **Progress bar:** Shows steps during inference (not a spinner)

---

## What Needs To Be Built

### Task 1: 3D Volume Rendering

Render the CT volume and organ masks in3D. The user should be able to rotate, zoom, pan.

**Approach:** Use `three.js` with `@react-three/fiber` and `@react-three/drei`. For medical imaging, consider:

- `cornerstone3D` — purpose-built for medical imaging, handles NIfTI natively, has 3D volume rendering
- `vtk.js` — powerful but heavy
- Simple isosurface extraction with marching cubes (scikit-image `measure.marching_cubes`) → render meshes in three.js

**Recommended path:** `cornerstone3D` since it already handles NIfTI, DICOM, windowing, and 3D rendering. Wrap it in a React component.

**Key files to modify:**
- `frontend/components/VolumeViewer.tsx` (new) — 3D rendering component
- `frontend/app/page.tsx` — add 3D viewer tab/toggle alongside 2D slice viewer
- `backend/utils/visualizer.py` — may need to export 3D data as numpy/npy or as a volume texture

**Backend consideration:** Currently returns base64 PNGs for 2D slices. For3D, either:
- Return the raw volume + mask as `.npy` files via a new endpoint
- Or have the frontend request the original NIfTI and parse it client-side with `nifti-reader` or `cornerstoneWADOImageLoader`

### Task 2: Organ Toggle (Show/Hide Overlays)

Let the user click organs to toggle their overlay visibility on the CT viewer.

**Current state:** `StatsPanel.tsx` shows detected organs with colored indicators and voxel counts, but clicking does nothing.

**What to build:**
- Add checkboxes/toggles next to each organ in `StatsPanel.tsx`
- Pass active organ set to `SliceViewer.tsx`
- In `SliceViewer.tsx`, only render overlay for organs in the active set
- "Select All" / "Deselect All" buttons

**Key files:**
- `frontend/components/StatsPanel.tsx` — add toggle UI
- `frontend/components/SliceViewer.tsx` — filter overlays by active organs
- `frontend/app/page.tsx` — manage active organ state, pass to both components

### Task 3: Make the Sidebar Useful

Currently the sidebar only has "Infer" — it's dead weight.

**Ideas for sidebar content:**
- **Organ list with toggles** (move from StatsPanel to sidebar) — keeps main content area clean
- **Case history** — show previous inference runs (store in localStorage or backend)
- **View mode switcher** — 2D slices / 3D volume / split view
- **Settings** — confidence threshold slider, overlay opacity, window/level controls
- **Export options** — download individual organs, download all, export as DICOM

**Recommended approach:** Move organ toggles to sidebar as a permanent panel. Add a view mode switcher (2D / 3D / Split).

---

## Architecture

### Frontend (`frontend/`)

```
app/
  page.tsx              — main workspace, manages state
  globals.css           — Material Design 3 tokens
  layout.tsx            — root layout, fonts
components/
  Sidebar.tsx           — navigation + organ toggles (TO BE EXPANDED)
  TopBar.tsx            — filename + slice count
  FileUpload.tsx        — drag-drop with progress bar
  SliceViewer.tsx       — 2D CT slice viewer with overlays
  StatsPanel.tsx        — organ list + coverage stats + download
  VolumeViewer.tsx      — (TO BE BUILT) 3D rendering
lib/
  api.ts                — API client, TypeScript types
```

**Key state in `page.tsx`:**
```typescript
const [result, setResult] = useState<InferenceResult | null>(null);
const [activeSlice, setActiveSlice] = useState(0);
const [activeOrgans, setActiveOrgans] = useState<Set<string>>(new Set());
const [viewMode, setViewMode] = useState<"2d" | "3d" | "split">("2d");
```

**API response format:**
```typescript
interface InferenceResult {
  status: string;
  filename: string;
  detected_organs: string[];
  organ_files: OrganFile[];
  statistics: Statistics;
  slice_images: SliceImage[];
  download_url: string;
}

interface OrganFile {
  name: string;
  filename: string;
  voxels: number;
}
```

### Backend (`backend/`)

```
main.py                — FastAPI app, endpoints
utils/
  suprem_engine.py     — SuPreM model wrapper
  visualizer.py        — 2D slice image generation
requirements.txt       — torch, monai, fastapi, cc3d, etc.
```

**Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/infer` | Upload CT, run inference |
| `GET` | `/api/download/{case}` | Download all masks as zip |
| `GET` | `/api/download/{case}/{organ}` | Download single organ mask |

**Model:** SuPreM (UNet3D backbone, ICLR 2024) at `SuPreM/direct_inference/pretrained_checkpoints/supervised_suprem_unet_2100.pth`

**Test data:** `BDMAP_00000338/ct.nii.gz` (502x348x71, spacing 0.816x0.816x2.5mm)

**Output format:** `backend/results/{case}/segmentations/{organ}.nii.gz` + `combined_labels.nii.gz`

---

## Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

**Prerequisites:**
- Python 3.13+, PyTorch 2.8+ with CUDA, MONAI 1.6+
- Node.js 18+
- Model checkpoint at `SuPreM/direct_inference/pretrained_checkpoints/supervised_suprem_unet_2100.pth` (222MB, download from HuggingFace `MrGiovanni/SuPreM`)

---

## Design Guidelines

- **Theme:** Material Design 3 light mode, tokens in `globals.css`
- **Fonts:** Inter (body), JetBrains Mono (code/data)
- **Colors:** Primary `#2d5a88`, surfaces white/gray, distinct colors per organ
- **No gradients, no heavy animations, no fake data** — clean and professional
- **Medical app feel:** Minimal, functional, data-focused

---

## Organ Colors

| Organ | Color |
|-------|-------|
| Spleen | #ff0000 |
| Right Kidney | #00cc00 |
| Left Kidney | #009900 |
| Gall Bladder | #ffcc00 |
| Esophagus | #ff6600 |
| Liver | #e64d00 |
| Stomach | #9900cc |
| Aorta | #0066ff |
| Postcava | #0033cc |
| Pancreas | #e600e6 |

---

## Known Issues

1. **No organ toggle** — overlays are always all-on, can't hide individual organs
2. **2D only** — no3D volume rendering
3. **Sidebar is minimal** — only has "Infer" icon, should be expanded
4. **Progress bar is estimated** — not tied to actual inference progress (backend doesn't stream progress)
5. **No error boundary** — if model fails, shows generic error message
