"use client";

import { BLOOMS_LEVELS } from "@/lib/blooms";
import type { BloomsLevel } from "@/lib/types";

interface BloomsBadgeProps {
  level: BloomsLevel;
  size?: "sm" | "md";
}

export function BloomsBadge({ level, size = "sm" }: BloomsBadgeProps) {
  const info = BLOOMS_LEVELS[level];
  const is_sm = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${
        is_sm ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1"
      }`}
      style={{
        borderColor: info.color,
        color: info.color,
        backgroundColor: `color-mix(in srgb, ${info.color} 12%, transparent)`,
      }}
    >
      <span
        className={`rounded-full ${is_sm ? "w-1.5 h-1.5" : "w-2 h-2"}`}
        style={{ backgroundColor: info.color }}
      />
      {info.label}
      {!is_sm && (
        <span className="text-[var(--color-text-on-dark-muted)] font-normal ml-1">
          {info.category}
        </span>
      )}
    </span>
  );
}
