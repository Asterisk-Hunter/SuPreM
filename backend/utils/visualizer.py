"""
Visualizer
==========
Generate slice-by-slice CT images and per-organ overlay images.
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


def _render_ct_slice(ct: np.ndarray) -> bytes:
    """Render a single CT slice as PNG bytes (grayscale, windowed)."""
    fig, ax = plt.subplots(1, 1, figsize=(6, 6), dpi=100)
    ct_display = np.clip(ct, -175, 250)
    ct_display = (ct_display - (-175)) / (250 - (-175))
    ax.imshow(ct_display.T, cmap="gray", origin="lower")
    ax.axis("off")
    plt.tight_layout(pad=0)
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="black", pad_inches=0)
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _render_organ_overlay(m: np.ndarray, organ_id: int, color: tuple) -> bytes:
    """Render a single organ overlay as PNG bytes (RGBA on black)."""
    fig, ax = plt.subplots(1, 1, figsize=(6, 6), dpi=100)
    ax.set_facecolor("black")
    overlay = np.zeros((*m.shape, 4))
    organ_mask = (m == organ_id)
    overlay[organ_mask] = [*color, 0.45]
    ax.imshow(np.transpose(overlay, (1, 0, 2)), origin="lower")
    ax.axis("off")
    plt.tight_layout(pad=0)
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="black", pad_inches=0)
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def generate_multi_organ_overlay(
    volume: np.ndarray,
    mask: np.ndarray,
    num_slices: int = 10,
) -> dict:
    """
    Create CT slice images and per-organ overlay images.

    Returns:
        {
            "ct_images": [{"slice_index": int, "image": base64}],
            "organ_overlays": {
                "Spleen": [{"slice_index": int, "image": base64}],
                ...
            },
            "organ_ids": {"Spleen": 1, ...}
        }
    """
    depth = volume.shape[2]
    indices = np.linspace(0, depth - 1, num_slices, dtype=int)

    ct_images = []
    organ_overlays: dict[str, list[dict]] = {name: [] for name in ORGAN_NAMES}
    organ_ids: dict[str, int] = {}

    for organ_id, color in ORGAN_COLORS.items():
        organ_ids[ORGAN_NAMES[organ_id - 1]] = organ_id

    for idx in indices:
        ct = volume[:, :, idx]
        m = mask[:, :, idx]

        # CT image
        ct_png = _render_ct_slice(ct)
        ct_images.append({
            "slice_index": int(idx),
            "image": base64.b64encode(ct_png).decode("utf-8"),
        })

        # Per-organ overlays
        for organ_id, color in ORGAN_COLORS.items():
            organ_name = ORGAN_NAMES[organ_id - 1]
            overlay_png = _render_organ_overlay(m, organ_id, color)
            organ_overlays[organ_name].append({
                "slice_index": int(idx),
                "image": base64.b64encode(overlay_png).decode("utf-8"),
            })

    return {
        "ct_images": ct_images,
        "organ_overlays": organ_overlays,
        "organ_ids": organ_ids,
    }
