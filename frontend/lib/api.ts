const API_BASE = "http://localhost:8000";

export interface OrganFile {
  name: string;
  filename: string;
  voxels: number;
}

export interface Statistics {
  volume_shape: number[];
  voxel_spacing_mm: number[];
  detected_organs: number;
  total_voxels: number;
  organ_voxels: number;
  coverage_pct: number;
  hu_range: [number, number];
}

export interface SliceImage {
  image: string;
  slice_index: number;
}

export interface InferenceResult {
  status: string;
  filename: string;
  detected_organs: string[];
  organ_files: OrganFile[];
  statistics: Statistics;
  slice_images: SliceImage[];
  download_url: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_type: string;
}

export async function runInference(file: File): Promise<InferenceResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/infer`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export function getDownloadUrl(filename: string): string {
  return `${API_BASE}/api/download/${encodeURIComponent(filename)}`;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}
