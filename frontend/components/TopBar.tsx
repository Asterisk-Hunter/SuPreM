"use client";

interface Props {
  filename?: string;
  sliceCount?: number;
}

export default function TopBar({ filename, sliceCount }: Props) {
  return (
    <header className="h-12 bg-surface border-b border-outline-variant flex items-center px-6 z-40 shrink-0 fixed top-0 left-16 right-0">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold text-on-surface tracking-tight">
          {filename || "CT Inference"}
        </h1>
        {filename && sliceCount && (
          <span className="text-[11px] text-on-surface-variant font-mono">
            {sliceCount} slices
          </span>
        )}
      </div>
    </header>
  );
}
