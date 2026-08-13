"use client";

import type { LucideIcon } from "lucide-react";

export interface StatItem {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Short label (e.g. "Volume") */
  label: string;
  /** Pre-formatted value */
  value: string;
  /** Optional caption / unit */
  hint?: string;
  /** Highlight value in warm (amber) color */
  emphasis?: boolean;
}

interface StatsGridProps {
  stats: StatItem[];
  /** Number of columns at desktop width. Defaults to 2. */
  columns?: 2 | 3;
}

/**
 * Grid of statistic cards displayed in the right panel.
 * Matches the screenshot's compact, icon+label+value layout.
 */
export function StatsGrid({ stats, columns = 2 }: StatsGridProps) {
  const gridClass =
    columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {stats.map(({ icon: Icon, label, value, hint, emphasis }) => (
        <div
          key={label}
          className="card-surface flex flex-col gap-1.5 p-3"
        >
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {label}
            </span>
          </div>
          <div
            className={[
              "font-mono text-sm font-semibold",
              emphasis ? "text-warm" : "text-text-primary",
            ].join(" ")}
          >
            {value}
          </div>
          {hint && (
            <div className="text-[10px] text-text-muted font-mono">
              {hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
