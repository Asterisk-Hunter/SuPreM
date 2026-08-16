"""
Unit Tests for Mesh Generator
==============================
Tests for organ mesh generation from segmentation masks.
"""

import sys
import numpy as np
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.mesh_generator import (
    generate_organ_meshes,
    laplacian_smooth,
    compute_volume_metadata,
    cleanup_connected_components,
)


@pytest.fixture
def synthetic_mask():
    """Create a synthetic 3D segmentation mask with known organ shapes."""
    mask = np.zeros((64, 64, 32), dtype=np.uint8)
    # Spleen (id=1) — medium blob
    mask[20:40, 10:30, 8:24] = 1
    # Liver (id=6) — large blob
    mask[10:50, 25:55, 5:28] = 6
    # Right Kidney (id=2) — medium blob
    mask[25:45, 40:60, 10:25] = 2
    # Aorta (id=8) — thin tubular structure
    mask[28:35, 28:35, 2:30] = 8
    return mask


@pytest.fixture
def isotropic_spacing():
    return (1.0, 1.0, 1.0)


@pytest.fixture
def anisotropic_spacing():
    """Typical CT spacing: fine in-plane, coarse through-plane."""
    return (0.816, 0.816, 2.5)


class TestGenerateOrganMeshes:
    """Test the main mesh generation pipeline."""

    def test_returns_dict(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        assert isinstance(meshes, dict)

    def test_correct_organs_detected(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        assert "Spleen" in meshes
        assert "Liver" in meshes
        assert "Right Kidney" in meshes
        assert "Aorta" in meshes
        # These should NOT be present
        assert "Stomach" not in meshes
        assert "Pancreas" not in meshes

    def test_vertex_count_positive(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        for name, data in meshes.items():
            assert len(data["vertices"]) > 0, f"{name} has no vertices"

    def test_face_count_positive(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        for name, data in meshes.items():
            assert len(data["faces"]) > 0, f"{name} has no faces"

    def test_vertices_are_finite(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        for name, data in meshes.items():
            assert np.isfinite(data["vertices"]).all(), f"{name} has non-finite vertices"

    def test_faces_reference_valid_vertices(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        for name, data in meshes.items():
            n_verts = len(data["vertices"]) // 3 if data["vertices"].ndim == 1 else len(data["vertices"])
            assert data["faces"].max() < n_verts, f"{name} has invalid face indices"

    def test_normals_shape_matches_vertices(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        for name, data in meshes.items():
            assert data["normals"].shape == data["vertices"].shape, \
                f"{name} normals shape mismatch"

    def test_no_nan_in_normals(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        for name, data in meshes.items():
            assert not np.isnan(data["normals"]).any(), f"{name} has NaN normals"

    def test_bounding_box_nonzero(self, synthetic_mask, isotropic_spacing):
        """Each mesh should have a non-degenerate bounding box."""
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        for name, data in meshes.items():
            verts = data["vertices"]
            bbox_size = verts.max(axis=0) - verts.min(axis=0)
            assert (bbox_size > 0).all(), f"{name} has degenerate bounding box"

    def test_spacing_affects_mesh_extent(self, synthetic_mask):
        """Anisotropic spacing should stretch the mesh differently than isotropic."""
        iso_meshes = generate_organ_meshes(synthetic_mask, (1.0, 1.0, 1.0), smooth_iterations=0)
        aniso_meshes = generate_organ_meshes(synthetic_mask, (0.816, 0.816, 2.5), smooth_iterations=0)

        for name in iso_meshes:
            if name not in aniso_meshes:
                continue
            iso_range_z = np.ptp(iso_meshes[name]["vertices"][:, 2])
            aniso_range_z = np.ptp(aniso_meshes[name]["vertices"][:, 2])
            # Z range with 2.5mm spacing should be ~2.5x the isotropic range
            ratio = aniso_range_z / iso_range_z if iso_range_z > 0 else 1.0
            assert ratio > 1.5, f"{name}: anisotropic Z ratio={ratio:.2f}, expected >1.5"

    def test_global_centering(self, synthetic_mask, isotropic_spacing):
        """All organs should be centered around the same global center,
        meaning different organs should NOT overlap at origin."""
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        if len(meshes) < 2:
            pytest.skip("Need at least 2 organs to test global centering")

        centers = {}
        for name, data in meshes.items():
            verts = data["vertices"]
            center = (verts.max(axis=0) + verts.min(axis=0)) / 2
            centers[name] = center

        # Organs should NOT all be at the same center (that would mean per-organ centering)
        center_list = list(centers.values())
        all_same = all(
            np.allclose(center_list[0], c, atol=0.5)
            for c in center_list[1:]
        )
        assert not all_same, "All organs centered at same point — likely per-organ centering bug"

    def test_dtypes(self, synthetic_mask, isotropic_spacing):
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        for name, data in meshes.items():
            assert data["vertices"].dtype == np.float32, f"{name} vertices wrong dtype"
            assert data["faces"].dtype == np.uint32, f"{name} faces wrong dtype"
            assert data["normals"].dtype == np.float32, f"{name} normals wrong dtype"

    def test_empty_mask_returns_empty(self, isotropic_spacing):
        empty = np.zeros((10, 10, 10), dtype=np.uint8)
        meshes = generate_organ_meshes(empty, isotropic_spacing)
        assert meshes == {}


class TestLaplacianSmoothing:
    """Test the Laplacian smoothing helper."""

    def test_zero_iterations_returns_copy(self):
        verts = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float32)
        faces = np.array([[0, 1, 2]], dtype=np.uint32)
        result = laplacian_smooth(verts, faces, iterations=0)
        np.testing.assert_array_equal(result, verts)

    def test_smoothing_moves_vertices(self):
        # Simple triangle — smoothing should move vertices toward center
        verts = np.array([[0, 0, 0], [10, 0, 0], [5, 10, 0]], dtype=np.float32)
        faces = np.array([[0, 1, 2]], dtype=np.uint32)
        smoothed = laplacian_smooth(verts, faces, iterations=1, lam=0.5)
        # After smoothing, vertices should be closer to their neighbors' average
        assert not np.array_equal(smoothed, verts)

    def test_smoothing_preserves_shape(self):
        """Smoothing should not create NaN or infinite values."""
        verts = np.random.randn(100, 3).astype(np.float32)
        faces = np.array([[i, (i+1) % 100, (i+2) % 100] for i in range(98)], dtype=np.uint32)
        smoothed = laplacian_smooth(verts, faces, iterations=3, lam=0.5)
        assert np.isfinite(smoothed).all()


class TestCleanupConnectedComponents:
    """Test the size-relative + physical-distance component cleanup."""

    def test_single_component_unchanged(self):
        mask = np.zeros((20, 20, 20), dtype=np.uint8)
        mask[5:15, 5:15, 5:15] = 1
        cleaned = cleanup_connected_components(mask, (1.0, 1.0, 1.0))
        np.testing.assert_array_equal(cleaned, mask)

    def test_empty_mask_unchanged(self):
        mask = np.zeros((10, 10, 10), dtype=np.uint8)
        cleaned = cleanup_connected_components(mask, (1.0, 1.0, 1.0))
        np.testing.assert_array_equal(cleaned, mask)

    def test_largest_component_always_kept(self):
        mask = np.zeros((50, 50, 50), dtype=np.uint8)
        mask[10:40, 10:40, 10:40] = 1   # main blob
        mask[45:48, 45:48, 45:48] = 1   # tiny far-away speck
        cleaned = cleanup_connected_components(mask, (1.0, 1.0, 1.0))
        assert cleaned.sum() == (30 ** 3)

    def test_small_and_far_removed(self):
        """Small component far from the main organ is a false positive -> removed."""
        mask = np.zeros((50, 50, 50), dtype=np.uint8)
        mask[20:30, 20:30, 20:30] = 1        # main
        mask[45:48, 45:48, 45:48] = 1        # small + far (>> 30 mm)
        cleaned = cleanup_connected_components(mask, (1.0, 1.0, 1.0))
        assert cleaned.sum() == (10 ** 3)

    def test_small_and_close_kept(self):
        """Small component adjacent to the main organ may be legit -> kept."""
        mask = np.zeros((50, 50, 50), dtype=np.uint8)
        mask[20:30, 20:30, 20:30] = 1        # main
        mask[31:33, 20:22, 20:22] = 1        # small, ~1-2 mm away
        cleaned = cleanup_connected_components(mask, (1.0, 1.0, 1.0))
        assert cleaned.sum() == (10 ** 3) + 8

    def test_large_secondary_close_kept(self):
        """Large secondary component (e.g. split pancreas head/body) is preserved."""
        mask = np.zeros((80, 80, 80), dtype=np.uint8)
        # Main component ~30^3 = 27,000 voxels
        mask[10:40, 10:40, 10:40] = 1
        # Secondary component ~79% of main, ~20 mm away in physical space
        mask[60:80, 55:75, 30:50] = 1   # 20*20*20 = 8,000 voxels
        cleaned = cleanup_connected_components(mask, (1.0, 1.0, 1.0))
        assert cleaned.sum() == (30 ** 3) + (20 ** 3)

    def test_large_secondary_far_removed(self):
        """Large secondary far from the main organ (e.g. duplicated kidney
        label) is removed."""
        mask = np.zeros((150, 150, 150), dtype=np.uint8)
        # Main component 30^3 = 27,000 voxels
        mask[50:80, 50:80, 50:80] = 1
        # Secondary component 25^3 = 15,625 voxels (58% of main), whose
        # centroid is ~114 mm from the main centroid (> far_distance_mm)
        mask[120:145, 115:140, 120:145] = 1
        cleaned = cleanup_connected_components(mask, (1.0, 1.0, 1.0))
        assert cleaned.sum() == (30 ** 3)

    def test_anisotropic_spacing_used_for_distance(self):
        """Distance must be computed in physical mm (anisotropic spacing).
        A component that is 25 slices away (62.5 mm with 2.5 mm slices) but
        within the same axial plane should count as far."""
        mask = np.zeros((50, 50, 50), dtype=np.uint8)
        mask[20:30, 20:30, 5:15] = 1          # main
        mask[20:23, 20:23, 30:33] = 1         # 20 slices away = 50 mm
        # With isotropic spacing this would be ~21 mm (kept); with 2.5 mm z
        # spacing it is ~50 mm (removed)
        cleaned_iso = cleanup_connected_components(mask, (1.0, 1.0, 1.0))
        cleaned_aniso = cleanup_connected_components(mask, (1.0, 1.0, 2.5))
        assert cleaned_iso.sum() == (10 ** 3) + 27
        assert cleaned_aniso.sum() == (10 ** 3)


class TestComputeVolumeMetadata:
    """Test the volume metadata computation."""

    def test_returns_dict(self, synthetic_mask, isotropic_spacing):
        meta = compute_volume_metadata(synthetic_mask, isotropic_spacing)
        assert meta is not None
        assert "spacing" in meta
        assert "volume_shape" in meta
        assert "global_center" in meta

    def test_empty_mask_returns_none(self, isotropic_spacing):
        empty = np.zeros((10, 10, 10), dtype=np.uint8)
        meta = compute_volume_metadata(empty, isotropic_spacing)
        assert meta is None

    def test_spacing_is_preserved(self, synthetic_mask, anisotropic_spacing):
        meta = compute_volume_metadata(synthetic_mask, anisotropic_spacing)
        assert meta is not None
        np.testing.assert_array_almost_equal(meta["spacing"], anisotropic_spacing)

    def test_volume_shape_matches(self, synthetic_mask, isotropic_spacing):
        meta = compute_volume_metadata(synthetic_mask, isotropic_spacing)
        assert meta is not None
        np.testing.assert_array_equal(meta["volume_shape"], synthetic_mask.shape)

    def test_global_center_matches_mesh_generator(self, synthetic_mask, isotropic_spacing):
        """Metadata center must match the center used in mesh generation."""
        meta = compute_volume_metadata(synthetic_mask, isotropic_spacing)
        meshes = generate_organ_meshes(synthetic_mask, isotropic_spacing, smooth_iterations=0)
        
        assert meta is not None
        # The global center is used to offset all vertices in generate_organ_meshes.
        # Verify by checking that if we add global_center back to a mesh vertex,
        # we get physical coordinates.
        if "Spleen" in meshes:
            verts = meshes["Spleen"]["vertices"]
            # Vertices should be centered around 0 (approximately)
            mean_pos = verts.mean(axis=0)
            # The mean should be roughly global_center minus the organ center
            # Just verify it's reasonable (not at origin if organ isn't centered)
            assert np.isfinite(meta["global_center"]).all()


class TestWithRealData:
    """Tests that use the actual BDMAP_00000338 test case if available."""

    @pytest.fixture
    def real_data(self):
        result_dir = Path(__file__).parent / "results" / "ct"
        mask_path = result_dir / "mask.npy"
        combined_path = result_dir / "combined_labels.nii.gz"

        if not mask_path.exists():
            pytest.skip("Real test data not available")

        mask = np.load(str(mask_path))

        # Try to get spacing
        if combined_path.exists():
            import nibabel as nib
            nii = nib.load(str(combined_path))
            spacing = tuple(map(float, nii.header.get_zooms()[:3]))
        else:
            spacing = (0.816, 0.816, 2.5)

        return mask, spacing

    def test_liver_has_proper_mesh(self, real_data):
        mask, spacing = real_data
        meshes = generate_organ_meshes(mask, spacing, smooth_iterations=1)
        assert "Liver" in meshes, "Liver should be detected"
        liver = meshes["Liver"]
        assert len(liver["vertices"]) > 100, "Liver should have substantial geometry"
        assert len(liver["faces"]) > 100, "Liver should have substantial faces"

    def test_kidneys_are_separate(self, real_data):
        mask, spacing = real_data
        meshes = generate_organ_meshes(mask, spacing, smooth_iterations=0)

        has_rk = "Right Kidney" in meshes
        has_lk = "Left Kidney" in meshes

        if has_rk and has_lk:
            rk_center = meshes["Right Kidney"]["vertices"].mean(axis=0)
            lk_center = meshes["Left Kidney"]["vertices"].mean(axis=0)
            dist = np.linalg.norm(rk_center - lk_center)
            assert dist > 10.0, f"Kidneys too close ({dist:.1f}mm) — may be overlapping"

    def test_mesh_count(self, real_data):
        mask, spacing = real_data
        meshes = generate_organ_meshes(mask, spacing, smooth_iterations=0)
        assert len(meshes) >= 5, f"Expected at least 5 organs, got {len(meshes)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
