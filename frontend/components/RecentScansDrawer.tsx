"use client";

import { useEffect, useState } from "react";
import { Clock, Trash2, FolderOpen, X, ArrowRight, Layers } from "lucide-react";
import { InferenceResult } from "@/lib/api";
import {
  StoredScan,
  getRecentScans,
  deleteRecentScan,
  clearAllRecentScans,
} from "@/lib/recentScans";

interface RecentScansDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScan: (result: InferenceResult) => void;
}

export default function RecentScansDrawer({
  isOpen,
  onClose,
  onSelectScan,
}: RecentScansDrawerProps) {
  const [scans, setScans] = useState<StoredScan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScans = async () => {
    setLoading(true);
    try {
      const data = await getRecentScans();
      setScans(data);
    } catch (err) {
      console.error("Failed to load recent scans", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadScans();
    }
  }, [isOpen]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteRecentScan(id);
    setScans((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all recent scans from history?")) {
      await clearAllRecentScans();
      setScans([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-surface h-full shadow-2xl border-l border-outline-variant flex flex-col z-10 animate-slide-in-left">
        {/* Drawer Header */}
        <div className="h-14 border-b border-outline-variant flex items-center justify-between px-5 bg-surface-container-lowest">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface">
              Recent Scans ({scans.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scans List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-xs font-mono text-on-surface-variant">
              Loading recent scan history...
            </div>
          ) : scans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-on-surface-variant">
              <Clock className="w-10 h-10 mb-3 opacity-30 text-outline" />
              <p className="text-sm font-medium text-on-surface">No Recent Scans</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Scans you upload will be automatically saved here so you can re-open them anytime.
              </p>
            </div>
          ) : (
            scans.map((scan) => (
              <div
                key={scan.id}
                onClick={() => {
                  onSelectScan(scan.result);
                  onClose();
                }}
                className="group relative bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant rounded-lg p-3.5 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded bg-primary/10 text-primary shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                      {scan.filename}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDelete(scan.id, e)}
                    className="p-1 text-outline hover:text-error hover:bg-error/10 rounded transition-colors opacity-60 group-hover:opacity-100 cursor-pointer"
                    title="Delete scan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-on-surface-variant">
                  <span className="bg-surface-container-high px-2 py-0.5 rounded font-mono">
                    {scan.sliceCount} slices
                  </span>
                  <span className="bg-surface-container-high px-2 py-0.5 rounded font-mono">
                    {scan.detected_organs.length} organs
                  </span>
                  <span className="text-outline font-mono ml-auto">
                    {new Date(scan.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Organ tags list snippet */}
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {scan.detected_organs.slice(0, 5).map((organ) => (
                    <span
                      key={organ}
                      className="text-[9px] bg-primary/5 text-on-surface-variant px-1.5 py-0.2 rounded border border-outline-variant/50"
                    >
                      {organ}
                    </span>
                  ))}
                  {scan.detected_organs.length > 5 && (
                    <span className="text-[9px] text-outline font-mono">
                      +{scan.detected_organs.length - 5} more
                    </span>
                  )}
                </div>

                <div className="flex items-center text-[10px] font-bold text-primary group-hover:translate-x-1 transition-transform mt-1">
                  <span>Open Scan</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {scans.length > 0 && (
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest">
            <button
              onClick={handleClearAll}
              className="w-full text-xs font-medium text-error hover:bg-error/10 py-2 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Recent History</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
