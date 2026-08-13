"use client";

import { useState, useCallback, useEffect } from "react";
import { SliceImage } from "@/lib/api";

interface Props {
  slices: SliceImage[];
  activeSlice: number;
  onSliceChange: (idx: number) => void;
}

export default function SliceViewer({
  slices,
  activeSlice,
  onSliceChange,
}: Props) {
  const total = slices.length;

  const prev = useCallback(
    () => onSliceChange(Math.max(0, activeSlice - 1)),
    [activeSlice, onSliceChange],
  );
  const next = useCallback(
    () => onSliceChange(Math.min(total - 1, activeSlice + 1)),
    [activeSlice, total, onSliceChange],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prev, next]);

  if (!slices.length) return null;

  const current = slices[activeSlice];

  return (
    <section className="flex-1 bg-viewport-bg flex flex-col relative hairline-border border-outline-variant">
      {/* Orientation Markers */}
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 font-mono text-xs text-white/50">
        <div className="flex justify-center uppercase">A</div>
        <div className="flex justify-between items-center h-full w-full absolute inset-0 px-4">
          <span className="uppercase">R</span>
          <span className="uppercase">L</span>
        </div>
        <div className="flex justify-center uppercase mt-auto z-20">P</div>
      </div>

      {/* Technical Overlays (Top-left) */}
      <div className="absolute top-4 left-4 z-20 font-mono text-xs text-clinical-amber pointer-events-none flex flex-col gap-1 drop-shadow-md">
        <span>S: {activeSlice + 1}/{total}</span>
        <span>Z: 145%</span>
        <span>W: 1500 L: -500</span>
      </div>

      {/* Crosshair */}
      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div className="w-full h-[1px] bg-white/20 absolute top-1/2 -translate-y-1/2" />
        <div className="h-full w-[1px] bg-white/20 absolute left-1/2 -translate-x-1/2" />
        <div className="w-4 h-4 border border-clinical-amber rounded-full" />
      </div>

      {/* CT Image */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
        <img
          src={`data:image/png;base64,${current.image}`}
          alt={`CT slice ${current.slice_index}`}
          className="max-w-full max-h-full object-contain relative z-0 mix-blend-screen opacity-90"
        />
      </div>

      {/* Film strip */}
      <div className="h-20 bg-[#111] border-t border-[#333] flex items-center px-2 z-20 film-strip overflow-x-auto gap-1 py-1">
        {slices.map((s, i) => (
          <button
            key={i}
            onClick={() => onSliceChange(i)}
            className={`
              min-w-[48px] h-full border transition-opacity cursor-pointer relative flex items-end justify-center pb-1
              ${
                i === activeSlice
                  ? "border-clinical-amber opacity-100"
                  : "border-transparent opacity-40 hover:opacity-70"
              }
            `}
          >
            <span className="font-mono text-[8px] text-white/70 absolute top-1 left-1">
              {s.slice_index}
            </span>
            <img
              src={`data:image/png;base64,${s.image}`}
              alt={`Slice ${s.slice_index}`}
              className="w-full h-full object-cover rounded-sm"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
