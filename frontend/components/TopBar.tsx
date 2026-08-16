"use client";

import { Upload, FolderOpen } from "lucide-react";

interface Props {
  filename?: string;
  sliceCount?: number;
  hasSidebar?: boolean;
  onReset?: () => void;
  onOpenRecentScans?: () => void;
  recentScansCount?: number;
}

export default function TopBar({
  filename,
  sliceCount,
  hasSidebar = false,
  onReset,
  onOpenRecentScans,
  recentScansCount = 0,
}: Props) {
  return (
    <header
      className={`h-12 bg-surface border-b border-outline-variant flex items-center justify-between px-6 z-40 shrink-0 fixed top-0 right-0 transition-all duration-300 ${
        hasSidebar ? "left-64" : "left-0"
      }`}
    >
      <div className="flex items-center gap-4">
        {filename ? (
          <>
            <h1 className="text-sm font-semibold text-on-surface tracking-tight">
              {filename}
            </h1>
            {sliceCount && (
              <span className="text-[11px] text-on-surface-variant font-mono bg-surface-container px-2 py-0.5 rounded">
                {sliceCount} slices
              </span>
            )}
          </>
        ) : (
          <h1 className="text-sm font-medium text-on-surface-variant flex items-center gap-2">
            <span>SuPreM CT Organ Segmentation Platform</span>
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onOpenRecentScans && (
          <button
            onClick={onOpenRecentScans}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded transition-colors cursor-pointer"
            title="View folder of recent CT scans"
          >
            <FolderOpen className="w-3.5 h-3.5 text-primary" />
            <span>Recent Scans</span>
            {recentScansCount > 0 && (
              <span className="ml-0.5 bg-primary text-on-primary text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
                {recentScansCount}
              </span>
            )}
          </button>
        )}

        {filename && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>New Upload</span>
          </button>
        )}
      </div>
    </header>
  );
}


