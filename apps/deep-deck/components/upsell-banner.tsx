"use client";

import { PACKS, formatPrice } from "@/lib/packs";

interface UpsellBannerProps {
  totalFull: number;
  onUpgrade: () => void;
}

export function UpsellBanner({ totalFull, onUpgrade }: UpsellBannerProps) {
  return (
    <div className="max-w-sm mx-auto w-full mb-4">
      <button
        onClick={onUpgrade}
        className="w-full bg-[var(--dd-redwood)]/10 border border-[var(--dd-redwood)]/20 rounded-xl px-4 py-3 text-left hover:bg-[var(--dd-redwood)]/15 transition-colors"
      >
        <p className="text-xs font-semibold text-[var(--dd-redwood)] uppercase tracking-wider mb-0.5">
          Unlock more cards
        </p>
        <p className="text-sm text-[var(--dd-cadet)]/70">
          {totalFull} more cards available with the Full Deck &mdash;{" "}
          <span className="font-semibold text-[var(--dd-redwood)]">
            {formatPrice(PACKS.full.priceCents)}
          </span>
        </p>
      </button>
    </div>
  );
}
