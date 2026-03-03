"use client";

import type { DepthLevel } from "@/lib/types";
import { DEPTH_LABELS } from "@/lib/types";

const DEPTHS: DepthLevel[] = ["deep", "deeper", "deepest"];

const DEPTH_COLORS: Record<DepthLevel, string> = {
  deep: "bg-[var(--dd-deep)]",
  deeper: "bg-[var(--dd-deeper)]",
  deepest: "bg-[var(--dd-deepest)]",
};

interface DepthSelectorProps {
  currentDepth: DepthLevel;
  onSelect: (depth: DepthLevel) => void;
}

export function DepthSelector({ currentDepth, onSelect }: DepthSelectorProps) {
  return (
    <div className="flex gap-2 justify-center" role="tablist" aria-label="Depth level">
      {DEPTHS.map((depth) => {
        const isActive = currentDepth === depth;
        return (
          <button
            key={depth}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(depth)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isActive
                ? `${DEPTH_COLORS[depth]} text-white shadow-md scale-105`
                : "bg-[var(--dd-cadet)]/10 text-[var(--dd-cadet)]/60 hover:bg-[var(--dd-cadet)]/20"
            }`}
          >
            {DEPTH_LABELS[depth]}
          </button>
        );
      })}
    </div>
  );
}
