"""
Inference Engine
================
Handles model loading, preprocessing, and prediction.
Supports both ONNX Runtime and PyTorch backends.
"""

import numpy as np
from scipy.ndimage import zoom


class InferenceEngine:
    """Run AI inference on 3D CT volumes."""

    def __init__(self, model_path: str):
        self.model_type = "onnx"
        self._load_onnx(model_path)

    def _load_onnx(self, path: str):
        """Load an ONNX model."""
        import onnxruntime as ort

        self.session = ort.InferenceSession(
            path,
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape
        print(f"   Input: {self.input_name} → {self.input_shape}")

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def _preprocess(self, volume: np.ndarray) -> np.ndarray:
        """Normalize and reshape volume for model input."""
        # Normalize to [0, 1]
        vmin, vmax = volume.min(), volume.max()
        volume = (volume - vmin) / (vmax - vmin + 1e-8)

        # Resize to model's expected spatial dims (skip batch/channel)
        target = tuple(self.input_shape[2:])
        if volume.shape != target:
            factors = [t / s for t, s in zip(target, volume.shape)]
            volume = zoom(volume, factors, order=1)

        # Add batch + channel: [1, 1, D, H, W]
        return volume[np.newaxis, np.newaxis].astype(np.float32)

    # ------------------------------------------------------------------
    # Postprocessing
    # ------------------------------------------------------------------

    def _postprocess(self, output: np.ndarray, original_shape: tuple) -> np.ndarray:
        """Convert model output back to original volume space."""
        mask = output[0]  # remove batch dim

        # If probabilities, threshold at 0.5
        if mask.max() <= 1.0:
            mask = (mask > 0.5).astype(np.float32)
        else:
            mask = (mask > 0).astype(np.float32)

        # Resize back to original shape
        if mask.shape != original_shape:
            factors = [o / m for o, m in zip(original_shape, mask.shape)]
            mask = zoom(mask, factors, order=0)  # nearest-neighbor for labels

        return mask

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, volume: np.ndarray) -> np.ndarray:
        """Full inference pipeline: preprocess → predict → postprocess."""
        original_shape = volume.shape
        processed = self._preprocess(volume)
        output = self.session.run(None, {self.input_name: processed})[0]
        return self._postprocess(output, original_shape)
