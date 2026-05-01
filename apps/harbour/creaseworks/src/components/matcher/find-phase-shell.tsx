"use client";

/**
 * FindPhaseShell — client-side orchestrator for all four find modes.
 *
 * Receives all data from the server component (materials, forms, slots,
 * contexts) and switches between modes entirely on the client. No server
 * round-trip on mode change → instant transitions, no flash.
 *
 * URL updates via history.replaceState so bookmarks/shares still work.
 * The server page reads `?mode=` on initial load to pick the right
 * starting mode.
 */

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import type { Material } from "./types";
import type { FindMode } from "./find-mode-selector";
import { materialSlug } from "@/lib/material-slug";

/* ── lazy imports for code-split — each mode only loads when used ── */
import RoomExplorer from "@/components/matcher/room-explorer";
import MatcherInputForm from "@/components/matcher/matcher-input-form";
import ChallengeShell from "@/components/challenge/challenge-shell";
import HuntShell from "@/components/hunt/hunt-shell";

/* ── hero copy per mode ─────────────────────────────────────────── */
const HEROES: Record<FindMode, { heading: string; emoji: string; body: string }> = {
  classic: {
    heading: "what do you notice?",
    emoji: "👀",
    body: "look around — what stuff do you have? cardboard boxes, sticks, old t-shirts, tape? pick what you find and we'll show you what these can become.",
  },
  rooms: {
    heading: "where are you right now?",
    emoji: "🏠",
    body: "pick a room and look around. tap the stuff you notice — everything counts.",
  },
  challenge: {
    heading: "how much can you notice?",
    emoji: "⏱️",
    body: "pick a time, then look around and tap what you spot!",
  },
  hunt: {
    heading: "who's exploring?",
    emoji: "🗺️",
    body: "pick your crew and we'll find you an adventure",
  },
};

/* ── content max-width varies per mode ──────────────────────────── */
const CONTENT_WIDTH: Record<FindMode, string> = {
  rooms: "max-w-5xl",
  classic: "max-w-5xl",
  challenge: "max-w-3xl",
  hunt: "max-w-sm",
};

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const MODES: { key: FindMode; emoji: string; label: string; description: string }[] = [
  { key: "classic", emoji: "📋", label: "classic picker", description: "tap what you have" },
  { key: "rooms", emoji: "🏠", label: "explore rooms", description: "look around a place" },
  { key: "challenge", emoji: "⏱️", label: "challenge", description: "how much can you notice?" },
  { key: "hunt", emoji: "🗺️", label: "scavenger hunt", description: "go find your stuff!" },
];

export interface FindPhaseShellProps {
  initialMode: FindMode;
  materials: Material[];
  forms: string[];
  slots: string[];
  contexts: string[];
  /**
   * Material slugs parsed from the URL's ?materials=<csv> query param.
   * Resolved to material IDs here (we hold the full materials array) and
   * forwarded as preselectedMaterialIds to whichever shell owns the
   * current mode. Unknown slugs are already filtered out by the page.
   */
  initialMaterialSlugs?: string[];
}

export default function FindPhaseShell({
  initialMode,
  materials,
  forms,
  slots,
  contexts,
  initialMaterialSlugs,
}: FindPhaseShellProps) {
  const [mode, setMode] = useState<FindMode>(initialMode);
  /* resetKey bumps when user clicks the already-active mode → forces remount */
  const [resetKey, setResetKey] = useState(0);
  const hero = HEROES[mode];

  /* Resolve ?materials=<csv> slugs to material IDs. The page has already
     filtered to known slugs; we still scope the lookup to the materials
     array on hand so any drift is silently dropped rather than passed
     through as a bogus id. */
  const preselectedMaterialIds = useMemo(() => {
    if (!initialMaterialSlugs || initialMaterialSlugs.length === 0) return [];
    const wanted = new Set(initialMaterialSlugs);
    const ids: string[] = [];
    for (const m of materials) {
      if (wanted.has(materialSlug(m.title))) ids.push(m.id);
    }
    return ids;
  }, [initialMaterialSlugs, materials]);

  const switchMode = useCallback((next: FindMode) => {
    setMode((prev) => {
      if (prev === next) {
        /* clicking the current mode resets that experience */
        setResetKey((k) => k + 1);
      }
      return next;
    });
    /* update URL without server round-trip — preserves basePath */
    const path = next === "rooms" ? "/find" : `/find?mode=${next}`;
    const basePath = "/harbour/creaseworks";
    window.history.replaceState(null, "", `${basePath}${path}`);
  }, []);

  return (
    <>
      {/* ── header zone — same width + height on all find modes ── */}
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-sm hover:opacity-80 transition-opacity mb-5 sm:mb-7 inline-flex items-center gap-1.5"
          style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
        >
          <span>&larr;</span> creaseworks
        </Link>

        {/* ── hero copy — fixed min-height for stability ────────── */}
        <div className="relative mb-6 sm:mb-8" style={{ minHeight: 152 }}>
          {/* decorative floating shapes — desktop only, purely ornamental */}
          <div
            aria-hidden="true"
            className="hidden sm:block absolute -left-10 top-2 w-5 h-5 rounded-lg"
            style={{
              /* champagne is a font-colour token — use cornflower for bg shapes */
              backgroundColor: "var(--wv-cornflower)",
              opacity: 0.18,
              transform: "rotate(12deg)",
            }}
          />
          <div
            aria-hidden="true"
            className="hidden sm:block absolute -left-6 top-12 w-3 h-3 rounded-full"
            style={{ backgroundColor: "var(--wv-sienna)", opacity: 0.22 }}
          />
          <div
            aria-hidden="true"
            className="hidden sm:block absolute -right-6 top-4 w-4 h-4 rounded-full"
            style={{ backgroundColor: "var(--wv-redwood)", opacity: 0.18 }}
          />

          <h1
            className="text-3xl sm:text-4xl font-bold font-serif tracking-tight mb-3"
            style={{ color: "var(--wv-cadet)" }}
          >
            {hero.heading}{" "}
            <span
              className="inline-block"
              style={{ animation: "heroWave 2s ease-in-out infinite" }}
            >
              {hero.emoji}
            </span>
          </h1>
          <p
            className="text-base sm:text-lg leading-relaxed max-w-xl"
            style={{ color: "var(--color-text-on-cream-muted)" }}
          >
            {hero.body}
          </p>
        </div>

        {/* ── mode selector — buttons, not links ─────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => switchMode(m.key)}
                className="rounded-xl px-3 py-3 text-center active:scale-[0.96] flex flex-col items-center gap-1 cursor-pointer"
                style={{
                  // UDL fix: inactive mode buttons were rgba-white-on-tint
                  // (≈1.05:1) — chrome was invisible. Now: solid white card
                  // with cadet border for 3:1 non-text + text-on-cream for AAA.
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
                <span className="text-lg leading-none">{m.emoji}</span>
                <span className="text-xs font-bold tracking-wider leading-tight">
                  {m.label}
                </span>
                <span
                  className="text-xs leading-tight hidden sm:block"
                  style={{ opacity: active ? 0.7 : 0.4, fontSize: "0.6rem" }}
                >
                  {m.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── content zone — width varies per mode ────────────── */}
      <div className={`${CONTENT_WIDTH[mode]} mx-auto`}>
        {mode === "rooms" && (
          <RoomExplorer
            key={`rooms-${resetKey}`}
            materials={materials}
            slots={slots}
            contexts={contexts}
            preselectedMaterialIds={preselectedMaterialIds}
          />
        )}
        {mode === "classic" && (
          <MatcherInputForm
            key={`classic-${resetKey}`}
            materials={materials}
            forms={forms}
            slots={slots}
            contexts={contexts}
            preselectedMaterialIds={preselectedMaterialIds}
          />
        )}
        {mode === "challenge" && (
          <ChallengeShell key={`challenge-${resetKey}`} materials={materials} slots={slots} />
        )}
        {mode === "hunt" && (
          <HuntShell key={`hunt-${resetKey}`} contexts={contexts} />
        )}
      </div>
    </>
  );
}
