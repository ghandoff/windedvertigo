"use client";

/**
 * FindModeSelector — lets kids (or parents) choose how to find.
 *
 * Four ways to explore the "find" phase:
 *   📋 classic picker  — the original tile-based material selector
 *   🏠 explore rooms   — spatial, place-based discovery
 *   ⏱️ challenge       — timed noticing game
 *   🗺️ scavenger hunt  — reversed matcher, go find stuff
 *
 * 2×2 grid of tappable cards (not pills). Displayed across all
 * find-phase routes so navigation is always available.
 */

import Link from "next/link";

export type FindMode = "rooms" | "classic" | "challenge" | "hunt";

interface FindModeSelectorProps {
  currentMode: FindMode;
}

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const MODES: { key: FindMode; href: string; emoji: string; label: string; description: string }[] = [
  { key: "classic", href: "/find?mode=classic", emoji: "📋", label: "classic picker", description: "tap what you have" },
  { key: "rooms", href: "/find", emoji: "🏠", label: "explore rooms", description: "look around a place" },
  { key: "challenge", href: "/find?mode=challenge", emoji: "⏱️", label: "challenge", description: "how much can you notice?" },
  { key: "hunt", href: "/find?mode=hunt", emoji: "🗺️", label: "scavenger hunt", description: "go find your stuff!" },
];

export default function FindModeSelector({
  currentMode,
}: FindModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
      {MODES.map((mode) => {
        const active = currentMode === mode.key;
        return (
          <Link
            key={mode.key}
            href={mode.href}
            className="rounded-xl px-3 py-3 text-center active:scale-[0.96] flex flex-col items-center gap-1"
            style={{
              // UDL fix: inactive tabs were rgba-white-on-tint with 1.05:1
              // affordance. Now: solid white card + cadet border so the
              // tab reads as a real object against the phase tint.
              backgroundColor: active
                ? "var(--wv-sienna)"
                : "var(--wv-white)",
              color: active
                ? "var(--wv-white)"
                : "var(--color-text-on-cream)",
              opacity: active ? 1 : 0.9,
              transition: `all 200ms ${SPRING}`,
              border: active
                ? "1.5px solid var(--wv-sienna)"
                : "1.5px solid rgba(39, 50, 72, 0.12)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span className="text-lg leading-none">{mode.emoji}</span>
            <span className="text-xs font-bold tracking-wider leading-tight">
              {mode.label}
            </span>
            <span
              className="text-xs leading-tight hidden sm:block"
              style={{ opacity: active ? 0.7 : 0.4, fontSize: "0.6rem" }}
            >
              {mode.description}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
