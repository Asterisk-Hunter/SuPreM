"use client";

import { useState } from "react";
import {
  Activity,
  Layers,
  Box,
  Columns,
  Eye,
  SlidersHorizontal,
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { OrganFile } from "@/lib/api";

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

interface SidebarProps {
  viewMode: "2d" | "3d" | "split";
  onViewModeChange: (mode: "2d" | "3d" | "split") => void;
  detectedOrgans: string[];
  organFiles: OrganFile[];
  activeOrgans: Set<string>;
  onToggleOrgan: (organ: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  overlayOpacity: number;
  onOpacityChange: (opacity: number) => void;
  showCTInMesh?: boolean;
  onShowCTInMeshChange?: (show: boolean) => void;
  showSlicePlane?: boolean;
  onShowSlicePlaneChange?: (show: boolean) => void;
  selectedOrgan?: string | null;
}

export default function Sidebar({
  viewMode,
  onViewModeChange,
  detectedOrgans,
  organFiles,
  activeOrgans,
  onToggleOrgan,
  onSelectAll,
  onDeselectAll,
  overlayOpacity,
  onOpacityChange,
  showCTInMesh,
  onShowCTInMeshChange,
  showSlicePlane,
  onShowSlicePlaneChange,
  selectedOrgan,
}: SidebarProps) {
  const [showHelp, setShowHelp] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrgans = organFiles.filter((organ) =>
    organ.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <nav className="w-64 h-full bg-surface border-r border-outline-variant flex flex-col z-50 shrink-0 fixed left-0 top-0 overflow-y-auto animate-slide-in-left shadow-lg">
      {/* Header */}
      <div className="h-12 border-b border-outline-variant flex items-center justify-between px-4 shrink-0 bg-surface-container-lowest">
        <div className="flex items-center">
          <Activity className="w-4 h-4 text-primary mr-2" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            SuPreM AI
          </span>
        </div>
        <button
          onClick={() => setShowHelp((prev) => !prev)}
          className={`p-1 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer ${
            showHelp
              ? "bg-primary/10 text-primary font-medium"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
          title="Toggle Quick Guide"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold">Guide</span>
        </button>
      </div>

      {/* Quick Start Guide */}
      {showHelp && (
        <section className="p-3 bg-surface-container-low border-b border-outline-variant text-[11px] flex flex-col gap-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-primary flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Quick Navigation
            </h4>
            <button
              onClick={() => setShowHelp(false)}
              className="text-[10px] text-on-surface-variant hover:text-on-surface"
            >
              Dismiss
            </button>
          </div>
          <ul className="flex flex-col gap-1 text-[10px] text-on-surface-variant list-disc pl-3.5 leading-relaxed">
            <li>
              <strong className="text-on-surface">View Mode:</strong> Switch 2D slices, 3D volume, or Split view.
            </li>
            <li>
              <strong className="text-on-surface">Organs:</strong> Click any organ below to toggle highlights on/off.
            </li>
            <li>
              <strong className="text-on-surface">Slices:</strong> Use <kbd className="font-mono bg-surface px-1 border border-outline-variant rounded">←</kbd> <kbd className="font-mono bg-surface px-1 border border-outline-variant rounded">→</kbd> keys to scrub slices.
            </li>
          </ul>
        </section>
      )}

      {/* View Mode Switcher */}
      <section className="p-3 border-b border-outline-variant">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-1.5">
          <Layers className="w-3 h-3" />
          VIEW MODE
        </h3>
        <div className="flex gap-1">
          {([
            { mode: "2d" as const, icon: Activity, label: "2D Slices" },
            { mode: "3d" as const, icon: Box, label: "3D Mesh" },
            { mode: "split" as const, icon: Columns, label: "Split" },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                viewMode === mode
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Organ Toggles */}
      <section className="p-3 border-b border-outline-variant flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            ORGANS ({activeOrgans.size}/{detectedOrgans.length})
          </h3>
          <div className="flex gap-1">
            <button
              onClick={onSelectAll}
              className="text-[9px] text-primary hover:text-inverse-surface transition-colors cursor-pointer font-bold px-1 py-0.5 rounded hover:bg-primary/10"
              title="Select all organs"
            >
              ALL
            </button>
            <span className="text-on-surface-variant text-[9px] self-center">|</span>
            <button
              onClick={onDeselectAll}
              className="text-[9px] text-primary hover:text-inverse-surface transition-colors cursor-pointer font-bold px-1 py-0.5 rounded hover:bg-primary/10"
              title="Deselect all organs"
            >
              NONE
            </button>
          </div>
        </div>

        {/* Search filter for organs */}
        {organFiles.length > 5 && (
          <div className="relative mb-2">
            <Search className="w-3 h-3 text-outline absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search organ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-[10px] pl-6 pr-2 py-1 bg-surface-container-lowest border border-outline-variant rounded focus:outline-hidden focus:border-primary"
            />
          </div>
        )}

        <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0 pr-0.5">
          {filteredOrgans.length === 0 ? (
            <div className="text-[10px] text-outline text-center py-4">
              No matching organs found
            </div>
          ) : (
            filteredOrgans.map((organ) => {
              const isActive = activeOrgans.has(organ.name);
              return (
                <button
                  key={organ.filename}
                  onClick={() => onToggleOrgan(organ.name)}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded transition-all cursor-pointer text-left w-full ${
                    selectedOrgan === organ.name
                      ? "bg-primary/15 font-bold ring-1 ring-primary/30"
                      : isActive
                        ? "bg-surface-container-high font-medium"
                        : "hover:bg-surface-container-low opacity-50 hover:opacity-80"
                  }`}
                  title={`Click to ${isActive ? "hide" : "show"} ${organ.name}`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-sm shrink-0 border transition-all ${
                      isActive ? "border-transparent scale-110" : "border-outline-variant"
                    }`}
                    style={{
                      backgroundColor: isActive
                        ? ORGAN_COLORS[organ.name] || "#666"
                        : "transparent",
                    }}
                  />
                  <span className="text-xs text-on-surface truncate flex-1">
                    {organ.name}
                  </span>
                  <span className="font-mono text-[9px] text-on-surface-variant shrink-0">
                    {(organ.voxels / 1000).toFixed(0)}k
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Settings */}
      <section className="p-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-1.5">
          <SlidersHorizontal className="w-3 h-3" />
          SETTINGS
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                Overlay Opacity
              </label>
              <span className="font-mono text-[10px] text-primary font-bold">
                {Math.round(overlayOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(overlayOpacity * 100)}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
              className="w-full h-1.5 bg-surface-variant rounded-full appearance-none cursor-pointer accent-primary"
            />
          </div>

        </div>
      </section>
    </nav>
  );
}

