"use client";

import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-16 h-full bg-surface border-r border-outline-variant flex flex-col items-center py-4 z-50 shrink-0 fixed left-0 top-0">
      <div className="flex flex-col items-center gap-1 w-full flex-1">
        <div
          className={`
            flex flex-col items-center gap-1 w-full py-3
            ${pathname === "/" ? "border-l-2 border-primary text-primary font-bold bg-surface-container-lowest" : "text-on-surface-variant"}
          `}
        >
          <Activity className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Infer
          </span>
        </div>
      </div>
    </nav>
  );
}
