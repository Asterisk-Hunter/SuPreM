"""
Mesh Generator
==============
Generate 3D surface meshes from organ segmentation masks using
scikit-image's Marching Cubes implementation.

Key features:
- Uses skimage.measure.marching_cubes for reliable isosurface extraction
- Accounts for anisotropic voxel spacing (critical for CT data)
- Performs connected-component cleanup (size-relative + physical-distance policy)
- Applies vectorized Laplacian smoothing to reduce voxel staircase artifacts
- Centers all organs using a shared global bounding box
"""

import numpy as np
import scipy.ndimage
from skimage.measure import marching_cubes

# Organ names matching SuPreM output (1-indexed organ IDs)
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

def cleanup_connected_components(
    binary_mask: np.ndarray,
    spacing: tuple[float, float, float],
    min_size_ratio: float = 0.10,
    near_distance_mm: float = 30.0,
    far_distance_mm: float = 100.0,
) -> np.ndarray:
    """
    Remove false-positive disconnected components from a binary organ mask.

    Segmentation models frequently produce scattered blobs far from the main
    organ (small specks, but also large ones — e.g. a kidney region labeled
    under BOTH kidney IDs). This cleanup removes those blobs without touching
    legitimate anatomy:

    Policy (applied per component, relative to the largest component):
    - Always keep the largest component.
    - "Small" components (size < min_size_ratio * largest): removed only when
      their physical centroid is farther than near_distance_mm from the largest
      component. Kept when close — they may be genuine organ-adjacent pieces.
    - "Large" components (size >= min_size_ratio * largest): potentially real
      anatomy (e.g. a pancreas split into head and body), removed only when
      farther than far_distance_mm.

    Distances are computed in PHYSICAL space — voxel spacing is applied per
    axis before taking the Euclidean norm — so anisotropic CT spacing
    (e.g. 0.816 x 0.816 x 2.5 mm) is handled correctly.

    Args:
        binary_mask: (D, H, W) uint8, 1 where the organ is present.
        spacing: (sz, sy, sx) voxel sizes in mm, in array axis order.
        min_size_ratio: components at or above this fraction of the largest
            are treated as potentially legitimate anatomy.
        near_distance_mm: small components farther than this (mm) from the
            largest component are removed.
        far_distance_mm: large secondary components farther than this (mm)
            from the largest component are removed.

    Returns:
        Cleaned binary mask, same shape and dtype as the input.
    """
    cleaned = binary_mask.copy()
    labeled, num_features = scipy.ndimage.label(cleaned)
    if num_features <= 1:
        return cleaned

    component_sizes = np.bincount(labeled.ravel())
    largest_idx = int(np.argmax(component_sizes[1:])) + 1
    largest_size = component_sizes[largest_idx]

    spacing_arr = np.array(spacing, dtype=np.float64)

    # Physical centroid of the largest (main) component
    main_pts = np.argwhere(labeled == largest_idx)
    main_center = main_pts.mean(axis=0) * spacing_arr

    for comp_idx in range(1, num_features + 1):
        if comp_idx == largest_idx:
            continue
        size = component_sizes[comp_idx]
        if size == 0:
            continue

        comp_pts = np.argwhere(labeled == comp_idx)
        comp_center = comp_pts.mean(axis=0) * spacing_arr
        dist_mm = float(np.linalg.norm(comp_center - main_center))
        rel_size = size / largest_size

        if rel_size < min_size_ratio:
            # Small component: remove only if spatially far from the main organ
            if dist_mm > near_distance_mm:
                cleaned[labeled == comp_idx] = 0
        else:
            # Large secondary component: potentially legitimate split anatomy
            # (e.g. pancreas head/body) — remove only if clearly far away
            if dist_mm > far_distance_mm:
                cleaned[labeled == comp_idx] = 0

    return cleaned


def laplacian_smooth(
    vertices: np.ndarray,
    faces: np.ndarray,
    iterations: int = 3,
    lam: float = 0.5,
) -> np.ndarray:
    """
    Vectorized Laplacian mesh smoothing.

    Moves each vertex towards the average of its neighbors. Uses sparse
    adjacency for efficiency — handles meshes with 100k+ vertices in
    reasonable time.

    Args:
        vertices: (N, 3) float array of vertex positions
        faces: (M, 3) int array of triangle indices
        iterations: number of smoothing passes
        lam: smoothing factor (0 = no smoothing, 1 = full average)

    Returns:
        Smoothed vertex positions (N, 3)
    """
    if iterations == 0 or len(vertices) == 0:
        return vertices.copy()

    from scipy.sparse import lil_matrix

    n_verts = len(vertices)
    # Build sparse adjacency matrix
    adj = lil_matrix((n_verts, n_verts), dtype=np.float32)

    for i in range(3):
        v1 = faces[:, i]
        v2 = faces[:, (i + 1) % 3]
        adj[v1, v2] = 1.0
        adj[v2, v1] = 1.0

    # Convert to CSR for fast matrix-vector multiplication
    adj_csr = adj.tocsr()
    # Compute degree (number of neighbors per vertex)
    degree = np.array(adj_csr.sum(axis=1)).flatten()
    # Avoid division by zero for isolated vertices
    degree[degree == 0] = 1.0

    smoothed = vertices.copy()
    for _ in range(iterations):
        # neighbor_avg[i] = sum of neighbor positions / degree
        neighbor_sum = adj_csr.dot(smoothed)
        neighbor_avg = neighbor_sum / degree[:, np.newaxis]
        smoothed = (1 - lam) * smoothed + lam * neighbor_avg

    return smoothed


def _compute_vertex_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """
    Compute per-vertex normals by averaging adjacent face normals.

    This is needed after smoothing because the original marching_cubes normals
    no longer match the displaced vertex positions.
    """
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]

    # Face normals via cross product
    face_normals = np.cross(v1 - v0, v2 - v0)

    # Accumulate face normals onto vertices
    vertex_normals = np.zeros_like(vertices)
    for i in range(3):
        np.add.at(vertex_normals, faces[:, i], face_normals)

    # Normalize
    norms = np.linalg.norm(vertex_normals, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    vertex_normals /= norms

    return vertex_normals.astype(np.float32)


def generate_organ_meshes(
    mask: np.ndarray,
    spacing: tuple[float, float, float],
    smooth_iterations: int = 3,
    smooth_lambda: float = 0.5,
) -> dict[str, dict]:
    """
    Generate triangle surface meshes for every organ in the segmentation mask.

    The pipeline for each organ:
    1. Extract binary mask
    2. Remove false-positive disconnected components (size-relative +
       physical-distance policy, see cleanup_connected_components)
    3. Run marching_cubes with physical voxel spacing
    4. Apply Laplacian smoothing to reduce voxel staircase artifacts
    5. Recompute vertex normals after smoothing
    6. Center using global bounding box (shared across ALL organs)

    Args:
        mask: (D, H, W) uint8 label map with organ IDs 1-32
        spacing: (sz, sy, sx) or (sx, sy, sz) voxel spacing in mm,
                 matching the array axis order from NIfTI get_zooms()
        smooth_iterations: number of Laplacian smoothing passes
        smooth_lambda: smoothing strength (0-1)

    Returns:
        dict mapping organ name -> {"vertices": float32, "faces": uint32, "normals": float32}
    """
    # Compute global center from bounding box of ALL labeled voxels
    nonzero = np.argwhere(mask > 0)
    if len(nonzero) == 0:
        return {}

    spacing_arr = np.array(spacing, dtype=np.float64)
    min_phys = nonzero.min(axis=0) * spacing_arr
    max_phys = nonzero.max(axis=0) * spacing_arr
    global_center = (min_phys + max_phys) / 2.0

    meshes = {}

    # Iterate over all possible organ IDs
    unique_ids = np.unique(mask)
    unique_ids = unique_ids[unique_ids > 0]  # skip background

    for organ_id in unique_ids:
        organ_id = int(organ_id)
        binary_mask = (mask == organ_id).astype(np.uint8)
        voxel_count = int(binary_mask.sum())

        if voxel_count == 0:
            continue

        # Resolve organ name
        if organ_id <= len(ORGAN_NAMES):
            organ_name = ORGAN_NAMES[organ_id - 1]
        else:
            organ_name = f"Organ_{organ_id}"

        # Connected-component cleanup: remove far-away false-positive blobs
        # (size-relative + physical-distance policy) while preserving the
        # largest component and legitimate split anatomy (e.g. pancreas).
        binary_mask = cleanup_connected_components(binary_mask, spacing)

        if binary_mask.sum() == 0:
            continue

        # Marching Cubes with physical spacing
        try:
            verts, faces, normals, _ = marching_cubes(
                binary_mask.astype(np.float32),
                level=0.5,
                spacing=spacing,
            )
        except Exception as e:
            print(f"[WARN] marching_cubes failed for {organ_name} (id={organ_id}): {e}")
            continue

        if len(verts) == 0 or len(faces) == 0:
            continue

        # Laplacian smoothing to reduce voxel staircase artifacts
        if smooth_iterations > 0:
            verts = laplacian_smooth(
                verts, faces,
                iterations=smooth_iterations,
                lam=smooth_lambda,
            )
            # Recompute normals after smoothing (original normals are now stale)
            normals = _compute_vertex_normals(verts, faces)

        # Center all organs using the SAME global center
        verts = verts - global_center

        meshes[organ_name] = {
            "vertices": verts.astype(np.float32),
            "faces": faces.astype(np.uint32),
            "normals": normals.astype(np.float32),
        }

        vert_count = len(verts)
        face_count = len(faces)
        print(f"  [MESH] {organ_name}: {vert_count:,} vertices, {face_count:,} faces")

    return meshes


def compute_volume_metadata(
    mask: np.ndarray,
    spacing: tuple[float, float, float],
) -> dict | None:
    """
    Compute volume metadata matching the centering used in mesh generation.
    
    This returns the same global_center that generate_organ_meshes uses,
    so the frontend can correctly position slice planes relative to meshes.
    """
    nonzero = np.argwhere(mask > 0)
    if len(nonzero) == 0:
        return None
    
    spacing_arr = np.array(spacing, dtype=np.float64)
    min_phys = nonzero.min(axis=0) * spacing_arr
    max_phys = nonzero.max(axis=0) * spacing_arr
    global_center = (min_phys + max_phys) / 2.0
    
    return {
        "spacing": spacing_arr,
        "volume_shape": np.array(mask.shape, dtype=np.int32),
        "global_center": global_center,
    }
