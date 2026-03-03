"use client";

import type { AgeBand } from "@/lib/types";
import { AGE_BAND_LABELS } from "@/lib/types";
import { getDeckSize } from "@/lib/deck";
import { useAccess } from "@/lib/use-access";

const AGE_BANDS: AgeBand[] = ["6-8", "9-10", "11-12", "13-14"];

const BAND_COLORS: Record<AgeBand, { bg: string; border: string; accent: string }> = {
  "6-8": {
    bg: "bg-amber-50",
    border: "border-amber-300",
    accent: "text-amber-700",
  },
  "9-10": {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    accent: "text-emerald-700",
  },
  "11-12": {
    bg: "bg-sky-50",
    border: "border-sky-300",
    accent: "text-sky-700",
  },
  "13-14": {
    bg: "bg-violet-50",
    border: "border-violet-300",
    accent: "text-violet-700",
  },
};

interface AgeBandPickerProps {
  onSelect: (band: AgeBand) => void;
}

export function AgeBandPicker({ onSelect }: AgeBandPickerProps) {
  const { entitlements } = useAccess();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
      {AGE_BANDS.map((band) => {
        const { grades, label } = AGE_BAND_LABELS[band];
        const colors = BAND_COLORS[band];
        const deckSize = getDeckSize(band, entitlements);

        return (
          <button
            key={band}
            onClick={() => onSelect(band)}
            className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dd-redwood)]`}
          >
            <p className={`text-2xl font-bold ${colors.accent}`}>{label}</p>
            <p className="text-sm text-[var(--dd-cadet)] opacity-70 mt-1">
              Grades {grades}
            </p>
            <p className="text-xs text-[var(--dd-cadet)] opacity-50 mt-3">
              {deckSize} cards in deck
            </p>
          </button>
        );
      })}
    </div>
  );
}
