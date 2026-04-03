"use client";

/**
 * Toolbar for selecting connection type when drawing a new connection.
 * Appears at the top of the canvas area when in connection mode.
 */

import type { ConnectionType } from "@/lib/types";

interface ConnectionDrawerProps {
  activeType: ConnectionType;
  onTypeChange: (type: ConnectionType) => void;
  isConnecting: boolean;
  onCancel: () => void;
}

const CONNECTION_TYPES: { type: ConnectionType; label: string; icon: string; color: string }[] = [
  { type: "amplifying", label: "amplifying (+)", icon: "+", color: "text-green-400" },
  { type: "dampening", label: "dampening (−)", icon: "−", color: "text-red-400" },
  { type: "delayed", label: "delayed (⏱)", icon: "⏱", color: "text-blue-400" },
  { type: "threshold", label: "threshold (⚡)", icon: "⚡", color: "text-amber-400" },
];

export function ConnectionDrawer({
  activeType,
  onTypeChange,
  isConnecting,
  onCancel,
}: ConnectionDrawerProps) {
  if (!isConnecting) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 mb-2">
      <span className="text-xs text-[var(--color-text-on-dark-muted)] mr-2">
        drawing connection:
      </span>

      {CONNECTION_TYPES.map(({ type, label, icon, color }) => (
        <button
          key={type}
          onClick={() => onTypeChange(type)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeType === type
              ? `bg-white/10 ${color}`
              : "text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)]"
          }`}
          aria-label={label}
        >
          <span>{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}

      <button
        onClick={onCancel}
        className="ml-auto px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] hover:bg-white/10 transition-all"
      >
        cancel (esc)
      </button>
    </div>
  );
}
