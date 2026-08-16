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
  ct_images: SliceImage[];
  organ_overlays: Record<string, SliceImage[]>;
  organ_ids: Record<string, number>;
  download_url: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_type: string;
}

export interface VolumeInfo {
  volume_shape: number[];
  spacing: number[];
  total_slices: number;
}

export async function fetchVolumeInfo(caseName: string): Promise<VolumeInfo> {
  const res = await fetch(`${API_BASE}/api/volume-info/${encodeURIComponent(caseName)}`);
  if (!res.ok) throw new Error(`Failed to fetch volume info: ${res.status}`);
  return res.json();
}

export async function runInference(
  file: File,
  onUploadProgress?: (progressPercent: number) => void
): Promise<InferenceResult> {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/infer`);

    if (xhr.upload && onUploadProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onUploadProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch {
          reject(new Error("Invalid JSON response from server"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP error ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during inference upload"));
    xhr.send(form);
  });
}

export function getDownloadUrl(filename: string): string {
  return `${API_BASE}/api/download/${encodeURIComponent(filename)}`;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}
