"use client";

import { PACKS, formatPrice } from "@/lib/packs";
import type { AgeBand } from "@/lib/types";
import { AGE_BAND_LABELS } from "@/lib/types";

interface UpsellEndScreenProps {
  ageBand: AgeBand;
  cardsPlayed: number;
  onRestart: () => void;
  onNewBand: () => void;
  onUpgrade: () => void;
}

export function UpsellEndScreen({
  ageBand,
  cardsPlayed,
  onRestart,
  onNewBand,
  onUpgrade,
}: UpsellEndScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center mb-6">
        <span className="text-2xl font-bold text-white">DD</span>
      </div>

      <h1 className="text-2xl font-bold text-[var(--dd-cadet)] mb-2">
        Sampler complete
      </h1>
      <p className="text-[var(--dd-cadet)]/60 mb-1">
        {AGE_BAND_LABELS[ageBand].label} &middot; Grades{" "}
        {AGE_BAND_LABELS[ageBand].grades}
      </p>
      <p className="text-3xl font-bold text-[var(--dd-redwood)] mb-4">
        {cardsPlayed} cards played
      </p>

      {/* Upsell box */}
      <div className="bg-white border-2 border-[var(--dd-redwood)]/20 rounded-2xl p-6 max-w-sm mx-auto mb-8">
        <p className="text-sm font-semibold text-[var(--dd-cadet)] mb-2">
          You&apos;ve played the free sampler
        </p>
        <p className="text-sm text-[var(--dd-cadet)]/60 mb-4">
          The full deck has 128 cards with deeper conversations, more games, and
          the complete wild card collection across all 4 age bands.
        </p>
        <button
          onClick={onUpgrade}
          className="w-full px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-redwood)] text-white hover:bg-[var(--dd-redwood)]/90 transition-colors mb-2"
        >
          Get the Full Deck &mdash; {formatPrice(PACKS.full.priceCents)}
        </button>
        <p className="text-xs text-[var(--dd-cadet)]/40">
          One-time purchase &middot; All future cards included
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRestart}
          className="px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-cadet)] text-white hover:bg-[var(--dd-cadet)]/90 transition-colors"
        >
          Play Again
        </button>
        <button
          onClick={onNewBand}
          className="px-6 py-3 rounded-xl text-sm font-medium bg-[var(--dd-cadet)]/10 text-[var(--dd-cadet)] hover:bg-[var(--dd-cadet)]/20 transition-colors"
        >
          New Age Group
        </button>
      </div>
    </div>
  );
}
