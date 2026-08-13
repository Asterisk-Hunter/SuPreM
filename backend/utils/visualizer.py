"""
Visualizer
==========
Generate slice-by-slice images with multi-organ segmentation overlay.
"""

import base64
from io import BytesIO

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np

# Distinct colors for 9 target organs (RGB 0-1)
ORGAN_COLORS = {
    1:  (1.0, 0.0, 0.0),    # Spleen - red
    2:  (0.0, 0.8, 0.0),    # Right Kidney - green
    3:  (0.0, 0.6, 0.0),    # Left Kidney - dark green
    4:  (1.0, 1.0, 0.0),    # Gall Bladder - yellow
    5:  (1.0, 0.4, 0.0),    # Esophagus - orange
    6:  (0.9, 0.3, 0.0),    # Liver - dark orange
    7:  (0.6, 0.0, 0.8),    # Stomach - purple
    8:  (0.0, 0.4, 1.0),    # Aorta - blue
    9:  (0.0, 0.2, 0.8),    # Postcava - dark blue
    10: (0.8, 0.0, 0.8),    # Portal Vein - magenta
    11: (0.9, 0.0, 0.9),    # Pancreas - pink
}

ORGAN_NAMES = [
    "Spleen", "Right Kidney", "Left Kidney", "Gall Bladder", "Esophagus",
    "Liver", "Stomach", "Aorta", "Postcava", "Portal Vein & Splenic Vein",
    "Pancreas",
]


def generate_multi_organ_overlay(
    volume: np.ndarray,
    mask: np.ndarray,
    num_slices: int = 10,
) -> list[dict]:
    """
    Create CT slice images with colored multi-organ overlay.

    Returns a list of dicts with slice_index and base64-encoded PNG.
    """
    depth = volume.shape[2]
    indices = np.linspace(0, depth - 1, num_slices, dtype=int)
    images = []

    for idx in indices:
        ct = volume[:, :, idx]
        m = mask[:, :, idx]

        fig, ax = plt.subplots(1, 1, figsize=(6, 6), dpi=100)

        # CT slice (windowed for soft tissue)
        ct_display = np.clip(ct, -175, 250)
        ct_display = (ct_display - (-175)) / (250 - (-175))
        ax.imshow(ct_display.T, cmap="gray", origin="lower")

        # Overlay each organ with its color
        for organ_id, color in ORGAN_COLORS.items():
            organ_mask = (m == organ_id)
            if organ_mask.any():
                overlay = np.zeros((*m.shape, 4))
                overlay[organ_mask] = [*color, 0.45]
                ax.imshow(overlay.T, origin="lower")

        ax.axis("off")
        plt.tight_layout(pad=0)

        buf = BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", facecolor="black", pad_inches=0)
        plt.close(fig)
        buf.seek(0)

        images.append({
            "slice_index": int(idx),
            "image": base64.b64encode(buf.read()).decode("utf-8"),
        })

    return images
