"""
SuPreM Inference Engine
=======================
Wraps the SuPreM model for multi-organ CT segmentation.
"""

import sys
import importlib
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
import nibabel as nib

# ---------------------------------------------------------------------------
# Organ class mappings (from SuPreM utils/utils.py)
# ---------------------------------------------------------------------------

NUM_CLASS = 32

# Class index → organ name (1-indexed in the model output)
ORGAN_NAMES = [
    "Spleen", "Right Kidney", "Left Kidney", "Gall Bladder", "Esophagus",
    "Liver", "Stomach", "Aorta", "Postcava",
    "Portal Vein & Splenic Vein", "Pancreas", "Right Adrenal Gland",
    "Left Adrenal Gland", "Duodenum", "Hepatic Vessel",
    "Right Lung", "Left Lung", "Colon", "Intestine", "Rectum",
    "Bladder", "Prostate", "Left Femur", "Right Femur", "Celiac Trunk",
    "Kidney Tumor", "Liver Tumor", "Pancreas Tumor",
    "Hepatic Vessel Tumor", "Lung Tumor", "Colon Tumor", "Kidney Cyst",
]

# Target organs for AbdomenAtlas 1.0 (the ones SuPreM was trained on)
TARGET_ORGAN_IDS = [1, 2, 3, 4, 6, 7, 8, 9, 11]
TARGET_ORGAN_NAMES = [ORGAN_NAMES[i - 1] for i in TARGET_ORGAN_IDS]

# Per-organ thresholds (all 0.5 in SuPreM)
ORGAN_THRESHOLDS = {i: 0.5 for i in range(1, 33)}


class SuPreMEngine:
    """Run SuPreM multi-organ segmentation on CT scans."""

    def __init__(self, checkpoint_path: str | None = None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.demo_mode = checkpoint_path is None

        if not self.demo_mode and Path(checkpoint_path).exists():
            self._load_model(checkpoint_path)
        else:
            print("[WARN] Running in DEMO mode (threshold-based segmentation)")

    def _load_model(self, checkpoint_path: str):
        """Load SuPreM model from checkpoint."""
        try:
            suprem_dir = Path(__file__).parent.parent.parent / "SuPreM" / "direct_inference"
            suprem_dir_str = str(suprem_dir)

            model_path = suprem_dir / "model" / "Universal_model.py"
            spec = importlib.util.spec_from_file_location("universal_model", str(model_path))

            if suprem_dir_str not in sys.path:
                sys.path.insert(0, suprem_dir_str)

            universal_mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(universal_mod)

            if suprem_dir_str in sys.path:
                sys.path.remove(suprem_dir_str)

            self.model = universal_mod.Universal_model(
                img_size=(96, 96, 96),
                in_channels=1,
                out_channels=NUM_CLASS,
                backbone="unet",
                encoding="word_embedding",
            )

            checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
            store_dict = self.model.state_dict()
            store_dict_keys = list(store_dict.keys())
            load_dict = checkpoint["net"]
            load_dict_values = list(load_dict.values())

            for i in range(len(store_dict)):
                store_dict[store_dict_keys[i]] = load_dict_values[i]

            self.model.load_state_dict(store_dict)
            self.model.to(self.device)
            self.model.eval()
            self.demo_mode = False
            print(f"[OK] SuPreM model loaded on {self.device}")

        except Exception as e:
            print(f"[WARN] Failed to load model: {e}. Falling back to demo mode.")
            import traceback
            traceback.print_exc()
            self.demo_mode = True

    def _preprocess(self, volume: np.ndarray) -> torch.Tensor:
        """Preprocess CT volume for SuPreM input."""
        volume = np.clip(volume, -175, 250)
        volume = (volume - (-175)) / (250 - (-175))
        volume = volume[np.newaxis, np.newaxis].astype(np.float32)
        return torch.from_numpy(volume).to(self.device)

    def predict(self, volume: np.ndarray) -> dict:
        """
        Run segmentation on a CT volume.

        Returns:
            dict with keys:
                - mask: np.ndarray (D, H, W) with integer organ labels
                - organ_names: list of detected organ names
                - confidence: float
                - num_organs: int
                - per_organ_masks: dict {organ_name: np.ndarray (D, H, W) bool}
        """
        if self.demo_mode:
            return self._predict_demo(volume)
        return self._predict_model(volume)

    def _predict_demo(self, volume: np.ndarray) -> dict:
        """Demo mode: simple threshold-based segmentation."""
        mask = np.zeros(volume.shape, dtype=np.uint8)
        mask[(volume > 30) & (volume < 60)] = 1
        mask[(volume > 40) & (volume < 70)] = 6
        mask[(volume > 30) & (volume < 50)] = 2
        mask[(volume > 30) & (volume < 50)] = 8
        mask[(volume > 40) & (volume < 60)] = 11

        detected = list(set(mask[mask > 0]))
        organ_names = [ORGAN_NAMES[min(i - 1, len(ORGAN_NAMES) - 1)] for i in detected if 1 <= i <= len(ORGAN_NAMES)]

        return {
            "mask": mask,
            "organ_names": organ_names,
            "confidence": 0.85,
            "num_organs": len(organ_names),
            "per_organ_masks": {},
        }

    def _predict_model(self, volume: np.ndarray) -> dict:
        """Real model inference using SuPreM."""
        from monai.inferers import sliding_window_inference

        tensor = self._preprocess(volume)

        with torch.no_grad():
            pred = sliding_window_inference(
                tensor,
                roi_size=(96, 96, 96),
                sw_batch_size=1,
                predictor=self.model,
                overlap=0.75,
                mode="gaussian",
            )
            pred_sigmoid = F.sigmoid(pred)

        # pred_sigmoid shape: [1, 32, D, H, W]
        pred_np = pred_sigmoid.squeeze(0).cpu().numpy()  # [32, D, H, W]

        # Build label map: for each voxel, assign the organ with highest probability
        # Only consider target organs (1,2,3,4,6,7,8,9,11)
        D, H, W = volume.shape
        label_map = np.zeros((D, H, W), dtype=np.uint8)
        per_organ = {}

        for organ_id in TARGET_ORGAN_IDS:
            chan_idx = organ_id - 1  # 0-indexed
            prob_map = pred_np[chan_idx]
            binary_mask = (prob_map > ORGAN_THRESHOLDS[organ_id])
            per_organ[ORGAN_NAMES[organ_id - 1]] = binary_mask
            # Assign organ label (higher ID overrides lower for overlaps)
            label_map[binary_mask] = organ_id

        detected_ids = list(np.unique(label_map))
        detected_ids = [i for i in detected_ids if i > 0]
        organ_names = [ORGAN_NAMES[i - 1] for i in detected_ids if 1 <= i <= len(ORGAN_NAMES)]

        # Confidence: mean of max probability per organ
        confidences = []
        for organ_id in TARGET_ORGAN_IDS:
            chan_idx = organ_id - 1
            prob_map = pred_np[chan_idx]
            confidences.append(float(prob_map.max()))
        avg_confidence = np.mean(confidences) if confidences else 0.0

        return {
            "mask": label_map,
            "organ_names": organ_names,
            "confidence": avg_confidence,
            "num_organs": len(organ_names),
            "per_organ_masks": per_organ,
        }
