"use client";

import { OrganFile } from "@/lib/api";
import { Download } from "lucide-react";
import { getDownloadUrl } from "@/lib/api";

interface StatsPanelProps {
  filename: string;
  detectedOrgans: string[];
  organFiles: OrganFile[];
  coveragePct: number;
  volumeShape: number[];
  organVoxels: number;
  downloadUrl: string;
}

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

export default function StatsPanel({
  filename,
  detectedOrgans,
  organFiles,
  coveragePct,
  volumeShape,
  organVoxels,
  downloadUrl,
}: StatsPanelProps) {
  return (
    <aside className="w-80 bg-surface flex flex-col z-30 shrink-0 border-l border-outline-variant">
      <div className="h-12 border-b border-outline-variant flex items-center px-4 shrink-0 bg-surface-container-lowest">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary">
          SEGMENTATION RESULTS
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {/* Detected Organs */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant pb-1">
            DETECTED ORGANS ({detectedOrgans.length})
          </h3>
          <div className="flex flex-col gap-1">
            {organFiles.map((organ) => (
              <div
                key={organ.filename}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-container-high transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: ORGAN_COLORS[organ.name] || "#666" }}
                  />
                  <span className="text-[15px] text-on-surface">{organ.name}</span>
                </div>
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {(organ.voxels / 1000).toFixed(0)}k
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Coverage */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant pb-1">
            COVERAGE
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(coveragePct, 100)}%` }}
              />
            </div>
            <span className="font-mono text-xs text-primary font-medium">
              {coveragePct}%
            </span>
          </div>
          <div className="font-mono text-xs text-on-surface-variant">
            {organVoxels.toLocaleString()} / {(volumeShape[0] * volumeShape[1] * volumeShape[2]).toLocaleString()} voxels
          </div>
        </section>

        {/* Volume Info */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant pb-1">
            VOLUME INFO
          </h3>
          <div className="font-mono text-xs text-on-surface-variant flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Dimensions:</span>
              <span>{volumeShape.join(" x ")}</span>
            </div>
          </div>
        </section>

        {/* Download */}
        <section className="mt-auto">
          <a
            href={getDownloadUrl(downloadUrl.replace("/api/download/", ""))}
            className="w-full bg-primary text-on-primary text-[11px] font-bold uppercase tracking-widest py-3 rounded hover:bg-inverse-surface transition-colors flex justify-center items-center gap-2 no-underline"
          >
            <Download className="w-4 h-4" />
            DOWNLOAD ALL MASKS
          </a>
        </section>
      </div>
    </aside>
  );
}
