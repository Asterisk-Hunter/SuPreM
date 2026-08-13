# CT Scan AI Inference

A web application that runs AI inference on medical CT scans and visualizes the results.

## 🏗️ Architecture

```
Frontend (Next.js)  →  Backend (FastAPI)  →  AI Model (ONNX/PyTorch)
     ↓                      ↓                      ↓
 Upload CT             Parse & Preprocess     Run Inference
 Visualize             Generate Masks         Return Results
```

## 🚀 Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt

# Place your model at models/ct_model.onnx
# Or run without a model (demo mode with threshold-based segmentation)

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload a CT scan.

## 📁 Project Structure

```
ct-inference-app/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── models/              # AI model files (.onnx)
│   ├── utils/
│   │   ├── inference.py     # Model loading & prediction
│   │   └── visualizer.py    # Slice image generation
│   ├── uploads/             # Temp upload storage
│   ├── results/             # Generated masks
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Main page
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── components/
│   │   ├── FileUpload.tsx   # Drag-and-drop upload
│   │   ├── StatsPanel.tsx   # Results statistics
│   │   └── SliceViewer.tsx  # 2D slice viewer
│   ├── lib/
│   │   └── api.ts           # API client
│   └── package.json
└── README.md
```

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/infer` | Upload CT scan & run inference |
| `GET` | `/api/download/{filename}` | Download segmentation mask |

## 📋 Supported Formats

- NIfTI (`.nii`, `.nii.gz`)
- DICOM (`.dcm`) — coming soon

## 🎯 Features

- ✅ Drag-and-drop file upload
- ✅ AI-powered CT segmentation
- ✅ 2D slice-by-slice viewer
- ✅ Segmentation overlay visualization
- ✅ Statistics panel
- ✅ Download segmentation masks
- ✅ Demo mode (no model required)

## 📝 Notes

- Without a model file, the app runs in **demo mode** using simple threshold-based segmentation
- Place your ONNX model at `backend/models/ct_model.onnx` for real inference
- The frontend proxies API requests to `http://localhost:8000`
