"use client";

import type { WildCard } from "@/lib/types";

interface WildBannerProps {
  wild: WildCard;
  onDismiss: () => void;
}

export function WildBanner({ wild, onDismiss }: WildBannerProps) {
  return (
    <div
      className="animate-banner bg-[var(--dd-redwood)] text-white rounded-xl p-4 shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">
            Wild Card Active
          </p>
          <p className="text-lg font-bold">{wild.title}</p>
          <p className="text-sm opacity-85 mt-1">{wild.effect}</p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Dismiss wild card"
        >
          <span className="text-sm font-bold">&times;</span>
        </button>
      </div>
    </div>
  );
}
