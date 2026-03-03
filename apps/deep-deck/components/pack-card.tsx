"use client";

import type { PackId } from "@/lib/types";
import { PACKS, formatPrice } from "@/lib/packs";

interface PackCardProps {
  packId: PackId;
  isOwned: boolean;
  onSelect: (packId: PackId) => void;
  featured?: boolean;
}

export function PackCard({ packId, isOwned, onSelect, featured }: PackCardProps) {
  const pack = PACKS[packId];
  const isFree = pack.priceCents === 0;

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 sm:p-8 transition-all ${
        featured
          ? "border-[var(--dd-redwood)] bg-white shadow-xl scale-[1.02]"
          : "border-[var(--dd-cadet)]/15 bg-white/80"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--dd-redwood)] text-white text-xs font-semibold px-3 py-1 rounded-full">
          Best Value
        </span>
      )}

      <h3 className="text-xl font-bold text-[var(--dd-cadet)] mb-1">
        {pack.name}
      </h3>
      <p className="text-sm text-[var(--dd-cadet)]/60 mb-4">
        {pack.description}
      </p>

      <p className="text-3xl font-bold text-[var(--dd-redwood)] mb-6">
        {formatPrice(pack.priceCents)}
        {!isFree && (
          <span className="text-sm font-normal text-[var(--dd-cadet)]/40 ml-1">
            one-time
          </span>
        )}
      </p>

      <ul className="space-y-2 mb-6">
        {pack.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-sm text-[var(--dd-cadet)]/80"
          >
            <svg
              className="w-4 h-4 mt-0.5 text-[var(--dd-redwood)] shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(packId)}
        disabled={isOwned}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
          isOwned
            ? "bg-[var(--dd-cadet)]/10 text-[var(--dd-cadet)]/40 cursor-default"
            : featured
              ? "bg-[var(--dd-redwood)] text-white hover:bg-[var(--dd-redwood)]/90"
              : "bg-[var(--dd-cadet)] text-white hover:bg-[var(--dd-cadet)]/90"
        }`}
      >
        {isOwned ? "Owned" : isFree ? "Play Free Sampler" : "Get the Full Deck"}
      </button>
    </div>
  );
}
