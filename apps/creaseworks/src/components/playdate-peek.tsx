"use client";

import { useState } from "react";

interface PlaydatePeekProps {
  title: string;
  headline: string | null;
  primaryFunction: string | null;
  hasFindAgain: boolean;
  ageRange: string | null;
  energyLevel: string | null;
}

export default function PlaydatePeek({
  title,
  headline,
  primaryFunction,
  hasFindAgain,
  ageRange,
  energyLevel,
}: PlaydatePeekProps) {
  const [expanded, setExpanded] = useState(false);

  const energyEmoji =
    energyLevel === "calm"
      ? "🧘"
      : energyLevel === "moderate"
        ? "⚡"
        : energyLevel === "active"
          ? "🔥"
          : null;

  return (
    <li className="rounded-lg border border-cadet/10 bg-champagne/20 overflow-hidden transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-champagne/30 transition-colors"
      >
        <div className="min-w-0">
          <span className="text-sm font-medium text-cadet">{title}</span>
          <div className="flex items-center gap-2 mt-1 text-xs text-cadet/40 flex-wrap">
            {primaryFunction && (
              <span className="rounded-full bg-champagne px-2 py-0.5">
                {primaryFunction}
              </span>
            )}
            {hasFindAgain && (
              <span className="rounded-full bg-redwood/10 text-redwood px-2 py-0.5">
                find again
              </span>
            )}
            {ageRange && (
              <span className="rounded-full bg-cadet/5 px-2 py-0.5">
                {ageRange}
              </span>
            )}
            {energyEmoji && (
              <span title={energyLevel ?? ""} className="text-xs">
                {energyEmoji}
              </span>
            )}
          </div>
        </div>
        <span className="text-cadet/30 text-xs shrink-0">
          {expanded ? "less ↑" : "peek ↓"}
        </span>
      </button>

      {/* expanded peek */}
      {expanded && headline && (
        <div className="px-4 pb-3 border-t border-cadet/5">
          <p className="text-xs text-cadet/50 mt-2 leading-relaxed">
            {headline}
          </p>
          <p className="text-[10px] text-cadet/30 mt-2 italic">
            purchase this pack to unlock the full playdate — step-by-step
            guide, materials list, swaps, and reflection prompts.
          </p>
        </div>
      )}

      {expanded && !headline && (
        <div className="px-4 pb-3 border-t border-cadet/5">
          <p className="text-[10px] text-cadet/30 mt-2 italic">
            purchase this pack to unlock the full playdate.
          </p>
        </div>
      )}
    </li>
  );
}
