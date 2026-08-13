"use client";

import { RefreshCw, HelpCircle } from "lucide-react";

interface Props {
  filename?: string;
  sliceCount?: number;
}

export default function TopBar({ filename, sliceCount }: Props) {
  return (
    <header className="h-12 bg-surface border-b border-outline-variant flex items-center justify-between px-6 z-40 shrink-0 fixed top-0 left-16 right-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-medium tracking-tighter text-primary">
          SCAN_ARCHITECT_V1
        </h1>
      </div>

      <div className="flex items-center gap-4 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
        <span className="hover:text-primary transition-colors cursor-pointer">
          ID: 88291-X
        </span>
        <span className="text-outline-variant">|</span>
        <span className="hover:text-primary transition-colors cursor-pointer">
          2023-10-24
        </span>
        <span className="text-outline-variant">|</span>
        <span className="text-primary">CT_CHEST_CONTRAST</span>
        <span className="text-outline-variant">|</span>
        <span className="hover:text-primary transition-colors cursor-pointer">
          Slices: {sliceCount || 512}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
        <button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
