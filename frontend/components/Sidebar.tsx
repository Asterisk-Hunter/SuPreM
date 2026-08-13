"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  Users,
  Clock,
  Activity,
  Settings,
} from "lucide-react";

const navItems = [
  { icon: Activity, label: "Infer", href: "/" },
  { icon: FolderOpen, label: "Cases", href: "/" },
  { icon: Users, label: "Patients", href: "/" },
  { icon: Clock, label: "Recent", href: "/" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-16 h-full bg-surface border-r border-outline-variant flex flex-col items-center py-4 z-50 shrink-0 fixed left-0 top-0">
      {/* Avatar */}
      <div className="mb-6 w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden">
        <span className="text-on-surface text-sm font-medium">DR</span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1 w-full items-center flex-1">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href && label === "Infer";

          return (
            <Link
              key={label}
              href={href}
              title={label}
              className={`
                flex flex-col items-center gap-1 w-full py-3 transition-colors duration-150 no-underline
                ${
                  isActive
                    ? "border-l-2 border-primary text-primary font-bold bg-surface-container-lowest"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }
              `}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Settings at bottom */}
      <div className="w-full">
        <Link
          href="/"
          title="Settings"
          className="flex flex-col items-center gap-1 w-full py-3 text-on-surface-variant hover:bg-surface-container-high transition-colors duration-150 no-underline"
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Settings
          </span>
        </Link>
      </div>
    </nav>
  );
}
