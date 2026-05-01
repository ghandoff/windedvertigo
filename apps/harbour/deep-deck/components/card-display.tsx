"use client";

import type { Card, DepthLevel } from "@/lib/types";
import { DEPTH_LABELS } from "@/lib/types";

interface CardDisplayProps {
  card: Card;
  isFlipped: boolean;
  currentDepth: DepthLevel;
  onFlip: () => void;
  drawKey: number;
}

function CardBack({ card, currentDepth }: { card: Card; currentDepth: DepthLevel }) {
  if (card.type === "conversation") {
    return (
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--dd-champagne)]" />
          <span className="text-xs font-medium tracking-wider text-[var(--dd-champagne)] opacity-80">
            Conversation
          </span>
        </div>
        <p className="text-lg sm:text-xl font-medium leading-relaxed text-white flex-1 animate-crossfade" key={currentDepth}>
          {card.prompts[currentDepth]}
        </p>
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-white/50 font-medium mb-1">
            {DEPTH_LABELS[currentDepth]} level
          </p>
          <p className="text-xs text-white/40 leading-relaxed">{card.tip}</p>
        </div>
      </div>
    );
  }

  if (card.type === "gamification") {
    return (
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--dd-sienna)]" />
          <span className="text-xs font-medium tracking-wider text-[var(--dd-sienna)] opacity-80">
            Game
          </span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-white mb-3">{card.title}</p>
        <p className="text-base text-white/85 leading-relaxed flex-1">{card.instructions}</p>
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40 leading-relaxed">{card.tip}</p>
        </div>
      </div>
    );
  }

  // Wild card
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-block w-3 h-3 rounded-full bg-[var(--dd-redwood)]" />
        <span className="text-xs font-medium tracking-wider text-[var(--dd-redwood)]">
          Wild Card
        </span>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-white mb-3">{card.title}</p>
      <p className="text-base text-white/85 leading-relaxed">{card.description}</p>
      <div className="mt-6 px-4 py-2 rounded-full bg-white/10 text-xs text-white/60">
        {card.effect}
      </div>
    </div>
  );
}

export function CardDisplay({ card, isFlipped, currentDepth, onFlip, drawKey }: CardDisplayProps) {
  const typeColor =
    card.type === "conversation"
      ? "from-[#273248] to-[#1a2233]"
      : card.type === "gamification"
        ? "from-[#3d2b1e] to-[#2a1d14]"
        : "from-[#4a1e18] to-[#331512]";

  return (
    <div className="card-scene w-full max-w-sm mx-auto animate-draw" key={drawKey}>
      <button
        onClick={onFlip}
        className="w-full aspect-[5/7] cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dd-redwood)] rounded-2xl"
        aria-label={isFlipped ? "Hide card" : "Reveal card"}
      >
        <div className={`card-inner ${isFlipped ? "is-flipped" : ""}`}>
          {/* Front — card back design */}
          <div className="card-face card-front bg-gradient-to-br from-[var(--dd-cadet)] to-[#1a2233] rounded-2xl flex flex-col items-center justify-center shadow-xl border border-white/5">
            <div className="w-16 h-16 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-white">DD</span>
            </div>
            <p className="text-sm font-medium text-white/40 tracking-widest uppercase">
              Tap to reveal
            </p>
          </div>

          {/* Back — card content */}
          <div className={`card-face card-back bg-gradient-to-br ${typeColor} rounded-2xl shadow-xl border border-white/5 overflow-hidden`}>
            <CardBack card={card} currentDepth={currentDepth} />
          </div>
        </div>
      </button>
    </div>
  );
}
