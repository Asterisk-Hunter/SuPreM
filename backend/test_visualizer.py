"""
Unit Tests for Visualizer Module
=================================
Tests for organ overlay generation and CT slice rendering.
"""

import sys
import numpy as np
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.visualizer import (
    generate_multi_organ_overlay,
    _render_ct_slice,
    _render_organ_overlay,
    ORGAN_COLORS,
    ORGAN_NAMES,
)


@pytest.fixture
def synthetic_volume():
    """Create a synthetic CT volume for testing."""
    np.random.seed(42)
    volume = np.random.randn(64, 64, 32).astype(np.float32) * 100
    return volume


@pytest.fixture
def synthetic_mask():
    """Create a synthetic mask with multiple organs."""
    mask = np.zeros((64, 64, 32), dtype=np.uint8)
    # Spleen (id=1)
    mask[10:30, 10:30, 5:25] = 1
    # Liver (id=6)
    mask[20:50, 20:50, 10:30] = 6
    # Right Kidney (id=2)
    mask[15:35, 40:60, 8:28] = 2
    return mask


class TestOrganColors:
    """Test organ color definitions."""

    def test_all_organs_have_colors(self):
        """Every organ name should have a defined color."""
        for i, name in enumerate(ORGAN_NAMES):
            organ_id = i + 1
            assert organ_id in ORGAN_COLORS, f"Missing color for organ: {name}"

    def test_colors_are_rgb_tuples(self):
        """Colors should be RGB tuples with values 0-1."""
        for organ_id, color in ORGAN_COLORS.items():
            assert len(color) == 3, f"Organ {organ_id} color should be RGB"
            assert all(0 <= c <= 1 for c in color), f"Organ {organ_id} color values out of range"

    def test_organ_names_count(self):
        """Should have 11 organ names defined."""
        assert len(ORGAN_NAMES) == 11


class TestRenderCTSlices:
    """Test CT slice rendering."""

    def test_render_returns_bytes(self, synthetic_volume):
        """Rendering a CT slice should return PNG bytes."""
        ct = synthetic_volume[:, :, 16]
        result = _render_ct_slice(ct)
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_render_png_header(self, synthetic_volume):
        """Output should be valid PNG (starts with PNG signature)."""
        ct = synthetic_volume[:, :, 16]
        result = _render_ct_slice(ct)
        # PNG signature: 89 50 4E 47 0D 0A 1A 0A
        assert result[:8] == b'\x89PNG\r\n\x1a\n'


class TestRenderOrganOverlay:
    """Test organ overlay rendering."""

    def test_render_returns_bytes(self, synthetic_mask):
        """Rendering an organ overlay should return PNG bytes."""
        m = synthetic_mask[:, :, 16]
        result = _render_organ_overlay(m, 1, (1.0, 0.0, 0.0))
        assert isinstance(result, bytes)
        assert len(result) > 0


class TestGenerateMultiOrganOverlay:
    """Test the main overlay generation function."""

    def test_returns_dict_with_expected_keys(self, synthetic_volume, synthetic_mask):
        """Should return dict with ct_images, organ_overlays, organ_ids."""
        result = generate_multi_organ_overlay(synthetic_volume, synthetic_mask, num_slices=3)

        assert isinstance(result, dict)
        assert "ct_images" in result
        assert "organ_overlays" in result
        assert "organ_ids" in result

    def test_ct_images_count(self, synthetic_volume, synthetic_mask):
        """Should generate the requested number of CT images."""
        num_slices = 5
        result = generate_multi_organ_overlay(synthetic_volume, synthetic_mask, num_slices=num_slices)
        assert len(result["ct_images"]) == num_slices

    def test_ct_images_have_required_fields(self, synthetic_volume, synthetic_mask):
        """Each CT image should have slice_index and image (base64)."""
        result = generate_multi_organ_overlay(synthetic_volume, synthetic_mask, num_slices=3)
        for img in result["ct_images"]:
            assert "slice_index" in img
            assert "image" in img
            assert isinstance(img["image"], str)
            assert len(img["image"]) > 0

    def test_organ_overlays_for_all_organs(self, synthetic_volume, synthetic_mask):
        """Should generate overlays for all defined organs."""
        result = generate_multi_organ_overlay(synthetic_volume, synthetic_mask, num_slices=3)
        for name in ORGAN_NAMES:
            assert name in result["organ_overlays"], f"Missing overlay for {name}"

    def test_organ_overlays_have_correct_structure(self, synthetic_volume, synthetic_mask):
        """Each organ overlay should have slice_index and image."""
        result = generate_multi_organ_overlay(synthetic_volume, synthetic_mask, num_slices=3)
        for name, overlays in result["organ_overlays"].items():
            assert len(overlays) == 3, f"Wrong number of overlays for {name}"
            for overlay in overlays:
                assert "slice_index" in overlay
                assert "image" in overlay

    def test_organ_ids_mapping(self, synthetic_volume, synthetic_mask):
        """Organ IDs should map names to numeric IDs."""
        result = generate_multi_organ_overlay(synthetic_volume, synthetic_mask, num_slices=3)
        for name in ORGAN_NAMES:
            assert name in result["organ_ids"], f"Missing ID for {name}"
            assert isinstance(result["organ_ids"][name], int)

    def test_single_slice(self, synthetic_volume, synthetic_mask):
        """Should work with a single slice."""
        result = generate_multi_organ_overlay(synthetic_volume, synthetic_mask, num_slices=1)
        assert len(result["ct_images"]) == 1
        for name in ORGAN_NAMES:
            assert len(result["organ_overlays"][name]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
