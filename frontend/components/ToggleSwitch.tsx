"use client";

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
}

export default function ToggleSwitch({ enabled, onChange, label }: Props) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      {label && (
        <span className="text-[15px] text-on-surface group-hover:text-primary transition-colors">
          {label}
        </span>
      )}
      <div className="relative inline-block w-8 mr-2 align-middle select-none transition duration-200 ease-in">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => onChange(!enabled)}
          className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-2 border-outline appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-4 checked:border-primary checked:bg-primary"
        />
        <label className="toggle-label block overflow-hidden h-4 rounded-full bg-surface-variant cursor-pointer" />
      </div>
    </label>
  );
}
