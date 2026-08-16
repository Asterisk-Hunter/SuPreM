"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Canvas, useThree, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { SliceImage, Statistics } from "@/lib/api";

const API_BASE = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Organ Colors (must match Sidebar.tsx)
// ---------------------------------------------------------------------------

const ORGAN_COLORS: Record<string, string> = {
  Spleen: "#ff0000",
  "Right Kidney": "#00cc00",
  "Left Kidney": "#009900",
  "Gall Bladder": "#ffcc00",
  Esophagus: "#ff6600",
  Liver: "#e64d00",
  Stomach: "#9900cc",
  Aorta: "#0066ff",
  Postcava: "#0033cc",
  "Portal Vein & Splenic Vein": "#cc00cc",
  Pancreas: "#e600e6",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrganMesh {
  name: string;
  vertices: Float32Array;
  faces: Uint32Array;
  normals: Float32Array;
  color: string;
}

interface VolumeMetadata {
  spacing: [number, number, number];
  volumeShape: [number, number, number];
  globalCenter: [number, number, number];
}

interface VolumeViewerProps {
  caseName: string;
  activeOrgans: Set<string>;
  activeSlice?: number;
  onSliceChange?: (idx: number) => void;
  totalSlices?: number;
  ctImages?: SliceImage[];
  statistics?: Statistics;
  selectedOrgan?: string | null;
  onSelectOrgan?: (organ: string | null) => void;
  showCTInMesh?: boolean;
  onShowCTInMeshChange?: (show: boolean) => void;
  showSlicePlane?: boolean;
  onShowSlicePlaneChange?: (show: boolean) => void;
}

// ---------------------------------------------------------------------------
// .npy parser
// ---------------------------------------------------------------------------

function parseNpy(buffer: ArrayBuffer): { data: Float32Array | Uint32Array | Uint8Array; shape: number[]; dtype: string } {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2),
    view.getUint8(3), view.getUint8(4), view.getUint8(5),
  );
  if (magic !== "\x93NUMPY") throw new Error("Invalid .npy file");

  const major = view.getUint8(6);
  const headerLen = major >= 2 ? view.getUint32(8, true) : view.getUint16(8, true);
  const headerStart = major >= 2 ? 12 : 10;
  const headerStr = new TextDecoder().decode(new Uint8Array(buffer, headerStart, headerLen));

  const descrRe = /descr['"]\s*:\s*['"]([^'"]+)['"]/;
  const descrMatch = headerStr.match(descrRe);
  const descr = descrMatch ? descrMatch[1] : "";

  const shapeRe = /shape['"]\s*:\s*\(([^)]*)\)/;
  const shapeMatch = headerStr.match(shapeRe);
  const shape = shapeMatch
    ? shapeMatch[1].split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    : [];

  const dataOffset = headerStart + headerLen;

  if (descr.includes("f4") || descr.includes("float32")) {
    return { data: new Float32Array(buffer, dataOffset, (buffer.byteLength - dataOffset) / 4), shape, dtype: "float32" };
  } else if (descr.includes("f8") || descr.includes("float64")) {
    const f64 = new Float64Array(buffer, dataOffset, (buffer.byteLength - dataOffset) / 8);
    const arr = new Float32Array(f64.length);
    for (let i = 0; i < f64.length; i++) arr[i] = f64[i];
    return { data: arr, shape, dtype: "float32" };
  } else if (descr.includes("u4") || descr.includes("uint32") || descr.includes("i4") || descr.includes("int32")) {
    return { data: new Uint32Array(buffer, dataOffset, (buffer.byteLength - dataOffset) / 4), shape, dtype: "uint32" };
  } else if (descr.includes("i8") || descr.includes("int64")) {
    const byteLen = buffer.byteLength - dataOffset;
    const count = byteLen / 8;
    const dv = new DataView(buffer, dataOffset);
    const arr = new Uint32Array(count);
    for (let i = 0; i < count; i++) arr[i] = dv.getUint32(i * 8, true);
    return { data: arr, shape, dtype: "uint32" };
  } else if (descr.includes("u1") || descr.includes("uint8")) {
    return { data: new Uint8Array(buffer, dataOffset), shape, dtype: "uint8" };
  } else if (descr.includes("U") || descr.includes("S")) {
    return { data: new Uint8Array(0), shape, dtype: "string" };
  } else {
    console.warn(`Skipping npy with unsupported dtype: ${descr}`);
    return { data: new Uint8Array(0), shape, dtype: "unknown" };
  }
}

async function parseNpz(buffer: ArrayBuffer): Promise<Record<string, { data: Float32Array | Uint32Array | Uint8Array; shape: number[]; dtype: string }>> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const result: Record<string, { data: Float32Array | Uint32Array | Uint8Array; shape: number[]; dtype: string }> = {};
  for (const name of Object.keys(zip.files)) {
    if (name.endsWith(".npy")) {
      const arrBuf = await zip.files[name]!.async("arraybuffer");
      const key = name.replace(".npy", "");
      result[key] = parseNpy(arrBuf);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// OrganSurfaceMesh
// ---------------------------------------------------------------------------

function OrganSurfaceMesh({
  mesh,
  isSelected,
  isFaded,
  onSelect,
}: {
  mesh: OrganMesh;
  isSelected: boolean;
  isFaded: boolean;
  onSelect: () => void;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(mesh.vertices, 3));
    geo.setIndex(new THREE.Uint32BufferAttribute(mesh.faces, 1));
    if (mesh.normals.length === mesh.vertices.length) {
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    geo.computeBoundingSphere();
    return geo;
  }, [mesh]);

  const color = useMemo(() => new THREE.Color(mesh.color), [mesh.color]);

  return (
    <mesh
      geometry={geometry}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        metalness={0.0}
        side={THREE.FrontSide}
        transparent={true}
        opacity={isFaded ? 0.15 : 1.0}
        depthWrite={!isFaded}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// SlicePlane - renders a plane at the current CT slice position
// ---------------------------------------------------------------------------

function SlicePlane({
  realSliceIndex,
  metadata,
  showCT,
  caseName,
}: {
  realSliceIndex: number;
  metadata: VolumeMetadata;
  showCT: boolean;
  caseName: string;
}) {
  const [ctTexture, setCTTexture] = useState<THREE.Texture | null>(null);
  const prevTextureRef = useRef<THREE.Texture | null>(null);

  // Physical position and dimensions
  const { position, width, height } = useMemo(() => {
    const [s0, s1, s2] = metadata.spacing;
    const [d0, d1] = metadata.volumeShape;
    const [c0, c1, c2] = metadata.globalCenter;

    const w = d0 * s0;
    const h = d1 * s1;
    const z = realSliceIndex * s2 - c2;
    const cx = w / 2 - c0;
    const cy = h / 2 - c1;

    return {
      position: [cx, cy, z] as [number, number, number],
      width: w,
      height: h,
    };
  }, [realSliceIndex, metadata]);

  // Load CT texture when showCT is enabled
  useEffect(() => {
    if (!showCT) {
      if (prevTextureRef.current) {
        prevTextureRef.current.dispose();
        prevTextureRef.current = null;
      }
      setCTTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(
      `${API_BASE}/api/ct-slice/${caseName}/${realSliceIndex}`,
      (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        if (prevTextureRef.current) prevTextureRef.current.dispose();
        prevTextureRef.current = tex;
        setCTTexture(tex);
      },
      undefined,
      (err) => console.warn("Failed to load CT slice texture:", err),
    );

    return () => {
      if (prevTextureRef.current) {
        prevTextureRef.current.dispose();
        prevTextureRef.current = null;
      }
    };
  }, [showCT, caseName, realSliceIndex]);

  const edgesGeo = useMemo(() => {
    const plane = new THREE.PlaneGeometry(width, height);
    const edges = new THREE.EdgesGeometry(plane);
    plane.dispose();
    return edges;
  }, [width, height]);

  return (
    <group position={position}>
      {/* CT texture or semi-transparent plane */}
      <mesh renderOrder={1}>
        <planeGeometry args={[width, height]} />
        {showCT && ctTexture ? (
          <meshBasicMaterial
            map={ctTexture}
            side={THREE.DoubleSide}
            transparent
            opacity={0.6}
            depthWrite={true}
            toneMapped={false}
          />
        ) : (
          <meshBasicMaterial
            color="#F59E0B"
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        )}
      </mesh>
      {/* Edge outline */}
      <lineSegments geometry={edgesGeo} renderOrder={2}>
        <lineBasicMaterial
          color={showCT ? "#ffffff" : "#F59E0B"}
          opacity={0.4}
          transparent
        />
      </lineSegments>
    </group>
  );
}

// ---------------------------------------------------------------------------
// CameraFitter
// ---------------------------------------------------------------------------

function CameraFitter({
  meshGroup,
  controlsRef,
}: {
  meshGroup: React.RefObject<THREE.Group | null>;
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const fitted = useRef(false);

  useFrame(() => {
    if (fitted.current) return;
    if (!meshGroup.current || meshGroup.current.children.length === 0) return;

    const box = new THREE.Box3().setFromObject(meshGroup.current);
    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;

    const perspCam = camera as THREE.PerspectiveCamera;
    const fov = perspCam.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    // Tight margin (1.35x) so the anatomy fills the viewport without clipping
    cameraDistance *= 1.35;

    perspCam.position.set(
      center.x + cameraDistance * 0.2,
      center.y + cameraDistance * 0.35,
      center.z + cameraDistance * 0.9,
    );
    perspCam.lookAt(center);
    perspCam.near = maxDim * 0.001;
    perspCam.far = cameraDistance * 10;
    perspCam.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }

    fitted.current = true;
  });

  return null;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

function Scene({
  organMeshes,
  activeOrgans,
  metadata,
  activeSlice,
  totalSlices,
  ctImages,
  caseName,
  selectedOrgan,
  onSelectOrgan,
  showCTInMesh,
  showSlicePlane,
}: {
  organMeshes: OrganMesh[];
  activeOrgans: Set<string>;
  metadata: VolumeMetadata | null;
  activeSlice: number;
  totalSlices: number;
  ctImages?: SliceImage[];
  caseName: string;
  selectedOrgan: string | null;
  onSelectOrgan: (organ: string | null) => void;
  showCTInMesh: boolean;
  showSlicePlane: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);

  const visibleMeshes = useMemo(
    () => organMeshes.filter(m => activeOrgans.has(m.name)),
    [organMeshes, activeOrgans],
  );

  // Compute the real volume slice index from activeSlice (index into ctImages)
  const realSliceIndex = useMemo(() => {
    if (ctImages && ctImages[activeSlice]) {
      return ctImages[activeSlice].slice_index;
    }
    // Fallback: linear mapping
    if (metadata) {
      const maxZ = metadata.volumeShape[2] - 1;
      return Math.round((activeSlice / Math.max(totalSlices - 1, 1)) * maxZ);
    }
    return activeSlice;
  }, [activeSlice, totalSlices, ctImages, metadata]);

  return (
    <>
      {/* Medical visualization lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, 0.8, 1]} intensity={0.8} />
      <directionalLight position={[-0.5, -0.3, -0.8]} intensity={0.3} />

      {/* Organ meshes */}
      <group ref={groupRef}>
        {visibleMeshes.map(mesh => (
          <OrganSurfaceMesh
            key={mesh.name}
            mesh={mesh}
            isSelected={selectedOrgan === mesh.name}
            isFaded={selectedOrgan !== null && selectedOrgan !== mesh.name}
            onSelect={() => onSelectOrgan(selectedOrgan === mesh.name ? null : mesh.name)}
          />
        ))}
      </group>

      {/* Slice plane */}
      {(showSlicePlane || showCTInMesh) && metadata && (
        <SlicePlane
          realSliceIndex={realSliceIndex}
          metadata={metadata}
          showCT={showCTInMesh}
          caseName={caseName}
        />
      )}

      <CameraFitter meshGroup={groupRef} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.6}
        zoomSpeed={1.2}
        panSpeed={0.8}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// StatusBar (loading)
// ---------------------------------------------------------------------------

const LOAD_STEPS = [
  "Downloading mesh data",
  "Reading server response",
  "Parsing organ geometry",
  "Building 3D surfaces",
  "Rendering anatomy",
];

function StatusBar({ currentStep, progress }: { currentStep: number; progress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-viewport-bg z-30">
      <div className="w-full max-w-sm flex flex-col gap-6 px-8">
        <div className="text-center">
          <p className="text-base font-semibold text-white tracking-tight">
            {LOAD_STEPS[currentStep]}
          </p>
          <p className="text-2xl font-bold font-mono text-clinical-amber mt-2">
            {Math.floor(progress)}%
          </p>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full rounded-full transition-all duration-200 ease-linear"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #F59E0B, #F97316)" }}
          />
        </div>
        <div className="flex flex-col gap-2">
          {LOAD_STEPS.map((step, i) => {
            const isDone = i < currentStep;
            const isCurrent = i === currentStep;
            return (
              <div
                key={step}
                className={`flex items-center gap-2.5 text-sm font-mono transition-colors ${
                  isDone ? "text-white/50" : isCurrent ? "text-clinical-amber font-semibold" : "text-white/20"
                }`}
              >
                {isDone ? (
                  <span className="text-emerald-400 w-4 text-center">✓</span>
                ) : isCurrent ? (
                  <span className="w-4 h-4 rounded-full border-2 border-clinical-amber border-t-transparent animate-spin inline-block shrink-0" />
                ) : (
                  <span className="w-4 text-center text-white/20">○</span>
                )}
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VolumeViewer
// ---------------------------------------------------------------------------

export default function VolumeViewer({
  caseName,
  activeOrgans,
  activeSlice = 0,
  onSliceChange,
  totalSlices = 1,
  ctImages,
  statistics,
  selectedOrgan = null,
  onSelectOrgan,
  showCTInMesh = false,
  onShowCTInMeshChange,
  showSlicePlane = false,
  onShowSlicePlaneChange,
}: VolumeViewerProps) {
  const [organMeshes, setOrganMeshes] = useState<OrganMesh[]>([]);
  const [metadata, setMetadata] = useState<VolumeMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadStep, setLoadStep] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);

  const handleSelectOrgan = useCallback(
    (organ: string | null) => onSelectOrgan?.(organ),
    [onSelectOrgan],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMeshes() {
      try {
        setLoading(true);
        setOrganMeshes([]);
        setMetadata(null);
        setError(null);
        setLoadStep(0);
        setLoadProgress(5);

        const res = await fetch(`${API_BASE}/api/mesh/${caseName}`);
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Failed to load meshes (HTTP ${res.status}): ${errBody}`);
        }
        if (cancelled) return;
        setLoadStep(1);
        setLoadProgress(30);

        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        setLoadStep(2);
        setLoadProgress(50);

        const npz = await parseNpz(buffer);
        if (cancelled) return;
        setLoadStep(3);
        setLoadProgress(70);

        // --- Parse metadata ---
        let parsedMetadata: VolumeMetadata | null = null;
        if (npz["_meta_spacing"] && npz["_meta_volume_shape"] && npz["_meta_global_center"]) {
          const sp = npz["_meta_spacing"].data;
          const vs = npz["_meta_volume_shape"].data;
          const gc = npz["_meta_global_center"].data;
          parsedMetadata = {
            spacing: [sp[0], sp[1], sp[2]] as [number, number, number],
            volumeShape: [vs[0], vs[1], vs[2]] as [number, number, number],
            globalCenter: [gc[0], gc[1], gc[2]] as [number, number, number],
          };
        } else if (statistics) {
          // Fallback: use statistics from inference result
          const shape = statistics.volume_shape;
          const spacing = statistics.voxel_spacing_mm;
          parsedMetadata = {
            spacing: [spacing[0], spacing[1], spacing[2]] as [number, number, number],
            volumeShape: [shape[0], shape[1], shape[2]] as [number, number, number],
            globalCenter: [
              (shape[0] * spacing[0]) / 2,
              (shape[1] * spacing[1]) / 2,
              (shape[2] * spacing[2]) / 2,
            ],
          };
        }
        setMetadata(parsedMetadata);

        // --- Parse organ meshes ---
        const vertexKeys = Object.keys(npz).filter(k => k.endsWith("_vertices") && !k.startsWith("_"));
        const meshes: OrganMesh[] = [];

        for (const vKey of vertexKeys) {
          const organName = vKey.replace("_vertices", "");
          const fKey = `${organName}_faces`;
          const nKey = `${organName}_normals`;
          if (!npz[vKey] || !npz[fKey]) continue;

          const vertices = npz[vKey].data instanceof Float32Array
            ? npz[vKey].data : new Float32Array(npz[vKey].data);
          const faces = npz[fKey].data instanceof Uint32Array
            ? npz[fKey].data : new Uint32Array(npz[fKey].data);
          const normals = npz[nKey]
            ? (npz[nKey].data instanceof Float32Array ? npz[nKey].data : new Float32Array(npz[nKey].data))
            : new Float32Array(0);

          if (vertices.length === 0 || faces.length === 0) continue;

          let valid = true;
          for (let i = 0; i < Math.min(vertices.length, 30); i++) {
            if (!isFinite(vertices[i])) { valid = false; break; }
          }
          if (!valid) {
            console.warn(`Skipping organ "${organName}": contains non-finite vertices`);
            continue;
          }

          meshes.push({
            name: organName,
            vertices,
            faces,
            normals,
            color: ORGAN_COLORS[organName] || "#888888",
          });
        }

        if (cancelled) return;
        if (meshes.length === 0) throw new Error("No valid organ meshes found in response");

        setOrganMeshes(meshes);
        setLoadStep(4);
        setLoadProgress(90);

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (cancelled) return;
        setLoadProgress(100);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("VolumeViewer load error:", err);
          setError(err instanceof Error ? err.message : "Failed to load 3D meshes");
          setLoading(false);
        }
      }
    }

    loadMeshes();
    return () => { cancelled = true; };
  }, [caseName]);

  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-viewport-bg">
        <div className="text-center max-w-md px-6">
          <p className="text-red-400 text-sm font-mono mb-2">3D Mesh Error</p>
          <p className="text-white/60 text-xs font-mono break-words">{error}</p>
        </div>
      </div>
    );
  }

  // Compute real slice index for the HUD
  const realSliceIdx = ctImages && ctImages[activeSlice]
    ? ctImages[activeSlice].slice_index
    : activeSlice;

  return (
    <section className="relative w-full h-full bg-viewport-bg" style={{ minHeight: 0 }}>
      {loading && <StatusBar currentStep={loadStep} progress={loadProgress} />}

      {/* HUD: title + controls */}
      {!loading && organMeshes.length > 0 && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-2 drop-shadow-md">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-clinical-amber">3D Volume View</span>
            <span className="text-[10px] text-white/50">
              Drag to rotate · Scroll to zoom · Right-drag to pan
            </span>
          </div>
          {/* Scan metadata */}
          {metadata && (
            <div className="flex flex-col gap-0.5 text-xs font-mono text-white/35">
              <span>{caseName}.nii.gz</span>
              <span>
                {metadata.volumeShape[0]} × {metadata.volumeShape[1]} × {metadata.volumeShape[2]}
              </span>
              <span>
                {metadata.spacing[0].toFixed(3)} × {metadata.spacing[1].toFixed(3)} × {metadata.spacing[2].toFixed(1)} mm
              </span>
            </div>
          )}
          
          {/* View Toggles */}
          <div className="mt-2 flex flex-col gap-1.5 pointer-events-auto">
            <label className="flex items-center gap-2 text-xs font-mono text-white/80 cursor-pointer w-fit hover:text-white">
              <input
                type="checkbox"
                checked={showSlicePlane}
                onChange={(e) => onShowSlicePlaneChange?.(e.target.checked)}
                className="accent-primary"
              />
              Show Slice Plane
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-white/80 cursor-pointer w-fit hover:text-white">
              <input
                type="checkbox"
                checked={showCTInMesh}
                onChange={(e) => onShowCTInMeshChange?.(e.target.checked)}
                className="accent-primary"
              />
              CT + Mesh
            </label>
          </div>

          {/* Slice Control Slider */}
          {(showSlicePlane || showCTInMesh) && onSliceChange && totalSlices > 1 && (
            <div className="mt-2 flex flex-col gap-1 pointer-events-auto border-t border-white/10 pt-2 w-48">
              <input
                type="range"
                min={0}
                max={totalSlices - 1}
                value={activeSlice}
                onChange={(e) => onSliceChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-clinical-amber"
                title="Adjust Slice Position"
              />
            </div>
          )}
        </div>
      )}

      {/* HUD: slice indicator */}
      {!loading && (showSlicePlane || showCTInMesh) && metadata && (
        <div className="absolute bottom-4 left-4 z-20 font-mono text-xs text-clinical-amber pointer-events-none drop-shadow-md">
          <span>Slice {realSliceIdx + 1} / {metadata.volumeShape[2]}</span>
          {showCTInMesh && <span className="ml-3 text-white/40">CT + Mesh</span>}
        </div>
      )}

      {/* Three.js Canvas */}
      {organMeshes.length > 0 && (
        <Canvas
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          gl={{ antialias: true, alpha: false }}
          camera={{ fov: 50, near: 0.1, far: 50000, position: [0, 0, 500] }}
          onCreated={({ gl }) => gl.setClearColor(new THREE.Color("#1A1A1A"), 1)}
          resize={{ debounce: 0 }}
          onPointerMissed={() => handleSelectOrgan(null)}
        >
          <Scene
            organMeshes={organMeshes}
            activeOrgans={activeOrgans}
            metadata={metadata}
            activeSlice={activeSlice}
            totalSlices={totalSlices}
            ctImages={ctImages}
            caseName={caseName}
            selectedOrgan={selectedOrgan}
            onSelectOrgan={handleSelectOrgan}
            showCTInMesh={showCTInMesh}
            showSlicePlane={showSlicePlane}
          />
        </Canvas>
      )}
    </section>
  );
}
