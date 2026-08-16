# Handoff — 3D Viewer Final Polish Pass

> For the next session. Task: finish the presentation polish on the 3D CT viewer, verify it, and report.

## Hard constraints (from the user)

Do NOT change: segmentation algorithm, NIfTI loading, mesh generation, coordinate system, CT extraction pipeline, organ masks, 2D viewer, slice synchronization, or the UI layout. Presentation-only changes; fix only confirmed rendering bugs. If it already looks good, do nothing.

## Current state

**Applied (keep as-is):**
- `backend/utils/mesh_generator.py` — `cleanup_connected_components()` (size-ratio + physical-distance policy, anisotropic spacing) replaced the old absolute-voxel cleanup. This fixed the floating-fragment meshes. **Done in a previous task — do not touch.**
- `frontend/components/VolumeViewer.tsx` — presentation tweaks:
  - Mesh material: `roughness 0.85`, `metalness 0.0` (matte)
  - Camera fit: 1.35× margin, angle `(0.2, 0.35, 0.9)` — verified centered/no-clip
  - Slice-plane outline opacity `0.4`; amber fallback plane opacity `0.15`

**DONE (final state):** CT slice-plane material is `transparent` + `opacity={0.6}`, `side={THREE.DoubleSide}`, `depthWrite={true}`, `toneMapped={false}`. Texture loader has no instrumentation logs.

## Verification findings (already done)

- Meshes render correctly; camera framing centered, fits viewport, no clipping.
- The "black CT texture" scare was a **measurement artifact**, not a bug: `ctx.drawImage(img,0,0)` into a small canvas samples only the top-left corner, which is genuinely black air in a CT slice. Full-image scaled sampling gives the correct mean. The browser decodes `/api/ct-slice/{case}/{idx}` PNGs fine; CORS headers are correct.
- CT+Mesh works: plane is a big slab; slice 0 is mostly air so it looks empty (real anatomy, not a bug); mid-abdomen slices show the CT body clearly.
- Slice sync / organ toggling verified in code: `activeSlice` is shared state between `SliceViewer` and `VolumeViewer` (real slice = `ctImages[activeSlice].slice_index`); mode switching does not reset the slice; toggling organs only filters meshes (no reload).
- `ORGAN_COLORS` are identical in `Sidebar.tsx` and `VolumeViewer.tsx`.

## Status

All presentation changes are applied and verified: `tsc --noEmit` clean, 13 frontend tests + 45 backend tests pass. Remaining optional work: live visual re-check of CT+Mesh at 60% opacity (see below), or nothing further.

## Environment / live verification (if needed)

- Backend already running on `:8000` (uvicorn `--reload`, SuPreM on CUDA). Frontend already running on `:3000` (Next dev, hot-reloads).
- Real test data: `backend/uploads/verify_ct.nii.gz` (CT built from `backend/results/ct/volume.npy`); case `verify_ct` has results + cached meshes in `backend/results/verify_ct/`. Re-running inference takes ~2.5 min.
- To skip re-inference in a fresh browser: inject a minimal `StoredScan` into IndexedDB `SuPreM_CT_Scans_DB` / store `recent_scans` (shape: `{id, filename, timestamp, detected_organs, sliceCount, result}`; `result.ct_images` only needs `slice_index` entries). Rebuild from `backend/results/verify_ct/mask.npy` + `volume.npy`.
- Browser automation: `agent-browser connect 9223` (Chrome launched with `--remote-debugging-port=9223 --user-data-dir=/tmp/ab-chrome2`). `agent-browser open` can hang — launch Chrome manually first, then `connect`. Screenshots go to `C:\Users\panne\AppData\Local\Temp`.
- Measurement gotcha: to sample an image's pixels, scale the whole image (`drawImage(img,0,0,w,h,0,0,40,40)`), not the top-left corner.

## Known issues / notes

- CT plane at slice 0 looks mostly empty (air) — leave as-is; don't auto-jump slices without asking.
- Cleanup keeps tiny 1–15 voxel specks within 30 mm of organs (intentional, per the "small AND far" rule) — tunable if desired.
- Repo state: `backend/utils/mesh_generator.py`, `frontend/components/VolumeViewer.tsx`, and test files are untracked working-tree files (pre-existing). `backend/results/`, `backend/uploads/`, `frontend/.next/` are gitignored.
