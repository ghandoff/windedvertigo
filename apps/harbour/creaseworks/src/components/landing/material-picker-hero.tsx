"use client";

/**
 * MaterialPickerHero — kid-friendly material grid for the logged-out
 * landing hero.
 *
 * Multi-select (2026-04): tiles toggle membership in a local Set; the
 * action bar slides up below once anything is picked and routes into
 * /find?materials=<csv>&mode=<rooms|classic>. The "or try the full
 * matcher" CTA in page.tsx still handles the zero-selection case.
 *
 * Kid refresh (2026-04): cream tiles on cadet bg, irregular squircle
 * corners, deterministic accent rotation (one per tile, never mixed),
 * phase-staggered idle wobble, tap = accent flash + squish.
 */

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useState } from "react";
import { materialSlug } from "@/lib/material-slug";
import CharacterSlot, { resolveCharacterFromForm } from "@windedvertigo/characters";
import { useCharacterVariant } from "@windedvertigo/characters/variant-context";

interface HeroMaterial {
  id: string;
  title: string;
  emoji: string | null;
  icon: string | null;
  form_primary: string | null;
}

interface MaterialPickerHeroProps {
  materials: HeroMaterial[];
}

const ACCENTS = [
  "var(--wv-cornflower)",
  "var(--wv-teal)",
  "var(--wv-seafoam)",
  "var(--wv-periwinkle)",
  "var(--wv-mint)",
] as const;

const CORNERS = [
  "22px 28px 18px 26px",
  "26px 20px 28px 22px",
  "20px 26px 24px 28px",
  "28px 22px 26px 20px",
] as const;

/** Hard cap at 12 — matches the tile count the hero renders. Defence in
 *  depth: the server also truncates if the URL arrives with more. */
const MAX_PICKED = 12;

export default function MaterialPickerHero({ materials }: MaterialPickerHeroProps) {
  const router = useRouter();
  // Ambient kid/grownup register — cookie-bootstrapped at root layout.
  const characterVariant = useCharacterVariant();
  /* slugs (not IDs) — the URL is the source of truth and slugs are
     stable across DB rebuilds; IDs aren't. FindPhaseShell resolves
     slug → ID once materials are in hand. */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < MAX_PICKED) next.add(slug);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const goto = useCallback(
    (mode: "rooms" | "classic") => {
      if (selected.size === 0) return;
      const csv = Array.from(selected).join(",");
      router.push(`/find?materials=${encodeURIComponent(csv)}&mode=${mode}`);
    },
    [router, selected],
  );

  const count = selected.size;
  const hasSelection = count > 0;

  return (
    <div className="mph-root w-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
      {materials.map((m, i) => {
        const slug = materialSlug(m.title);
        const isSelected = selected.has(slug);
        const accent = ACCENTS[i % ACCENTS.length];
        const corners = CORNERS[i % CORNERS.length];
        // crayon-drawer asymmetry: every 4th tile tilts back or forward
        const restRotation = i % 4 === 0 ? -2 : i % 4 === 3 ? 2 : 0;

        return (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(slug)}
            className={`mph-tile${isSelected ? " mph-tile--on" : ""}`}
            aria-pressed={isSelected}
            aria-label={
              isSelected
                ? `remove ${m.title} from your list`
                : `add ${m.title} to your list`
            }
            style={{
              ["--accent" as string]: accent,
              ["--corners" as string]: corners,
              ["--rest-rotation" as string]: `${restRotation}deg`,
              ["--wobble-delay" as string]: `${(i * 0.37) % 3.6}s`,
              ["--in-delay" as string]: `${i * 50}ms`,
            }}
          >
            <span className="mph-icon-wrap">
              {(() => {
                // Resolve character host from form_primary first, then title fallback.
                // Returns null for crate/mud/drip until those characters are built,
                // AND null when no keyword matches — in both cases we fall back.
                const char = resolveCharacterFromForm(m.form_primary, m.title);
                const slot = char ? <CharacterSlot character={char} size={48} animate={false} variant={characterVariant} /> : null;
                if (slot) return slot;
                if (m.icon) return (
                  <Image
                    src={`/harbour/creaseworks/icons/materials/${m.icon}.png`}
                    alt=""
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                );
                return <span className="mph-emoji">{m.emoji ?? "🧱"}</span>;
              })()}
            </span>
            <span className="mph-label">{m.title}</span>
            <span className="mph-accent-chip" aria-hidden="true">
              {isSelected && (
                <svg
                  viewBox="0 0 12 12"
                  width="10"
                  height="10"
                  aria-hidden="true"
                  style={{ display: "block" }}
                >
                  <path
                    d="M2.5 6.2 L5 8.5 L9.5 3.8"
                    fill="none"
                    stroke="var(--wv-white)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
          </button>
        );
      })}
      </div>

      {/* ── action bar — slides up once anything is picked ─────── */}
      {hasSelection && (
        <div className="mph-actions" role="region" aria-label="selected materials">
          <button
            type="button"
            onClick={clear}
            className="mph-clear"
          >
            clear
          </button>

          <span
            className="mph-count"
            aria-live="polite"
          >
            {count} thing{count === 1 ? "" : "s"} picked
          </span>

          <div className="mph-cta-stack">
            <button
              type="button"
              onClick={() => goto("rooms")}
              className="mph-primary"
            >
              find playdates →
            </button>
            <button
              type="button"
              onClick={() => goto("classic")}
              className="mph-secondary"
            >
              try the classic picker
            </button>
          </div>
        </div>
      )}

      <style>{`
        /* selector specificity note: globals.css ships an aggressive
           "rounder EVERYTHING" + "physical button" system at
           button:not([type="submit"]):not(.wv-header-signout) (0,2,1)
           that overrides border-radius to 14px and adds transform:
           scale(0.95) on active — fighting our squircle geometry and
           the component's individual transform properties. We match
           that selector shape + add .mph-tile so our rules win on
           specificity (0,3,1) rather than source order alone.         */
        button.mph-tile:not([type="submit"]):not(.wv-header-signout) {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 8px 16px;
          min-height: 120px;
          background: var(--wv-cream);
          border: 1px solid rgba(39, 50, 72, 0.08);
          border-radius: var(--corners);
          cursor: pointer;
          font-family: var(--font-nunito), ui-sans-serif, system-ui, sans-serif;
          font-weight: 700;
          box-shadow: 0 2px 0 rgba(39, 50, 72, 0.08);

          /* individual transform properties so hover/active don't fight the wobble.
             we also clear 'transform' explicitly so the global :active rule
             (transform: scale(0.95)) can't compose with our 'scale:' property. */
          transform: none;
          rotate: var(--rest-rotation);
          translate: 0 0;
          scale: 1;

          transition: translate 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
                      scale 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
                      background 140ms ease,
                      border-color 140ms ease,
                      box-shadow 180ms ease;

          animation: mphIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--in-delay) both,
                     mphWobble 3.6s ease-in-out var(--wobble-delay) infinite;
        }

        button.mph-tile:not([type="submit"]):not(.wv-header-signout):hover {
          transform: none;
          translate: 0 -2px;
          scale: 1.04;
          box-shadow: 0 6px 0 rgba(39, 50, 72, 0.1), 0 0 0 2px var(--accent);
        }

        button.mph-tile:not([type="submit"]):not(.wv-header-signout):active {
          transform: none;
          scale: 0.92;
          background: var(--accent);
          transition: scale 80ms ease, background 80ms ease;
          animation: mphIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--in-delay) both,
                     mphWobble 3.6s ease-in-out var(--wobble-delay) infinite,
                     mphTap 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        button.mph-tile:not([type="submit"]):not(.wv-header-signout):focus-visible {
          outline: 3px solid var(--color-focus);
          outline-offset: 3px;
        }

        /* selected state — thicker border + filled accent chip. uses
           the same --accent the tile already owns so each selected tile
           keeps its own colour identity. */
        button.mph-tile--on:not([type="submit"]):not(.wv-header-signout) {
          border: 2px solid var(--accent);
          box-shadow: 0 4px 0 rgba(39, 50, 72, 0.12), 0 0 0 3px rgba(39, 50, 72, 0.05);
        }

        .mph-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
        }

        .mph-emoji {
          font-size: 32px;
          line-height: 1;
        }

        .mph-label {
          font-weight: 800;
          font-size: 12px;
          line-height: 1.15;
          color: var(--wv-cadet);
          text-align: center;
          letter-spacing: 0.01em;
          /* keep long slashed compounds ("glue stick/white/washable") inside
             the tile — slashes are valid break points and anywhere lets
             narrow widths chunk words as a last resort. text-wrap: balance
             gives us roughly equal line widths on 2-3 line labels.          */
          overflow-wrap: anywhere;
          word-break: break-word;
          text-wrap: balance;
          max-width: 100%;
        }

        .mph-accent-chip {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .mph-tile--on .mph-accent-chip {
          transform: scale(1.15);
        }

        /* ── action bar ───────────────────────────────────────────── */
        .mph-actions {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px 16px;
          margin-top: 24px;
          padding: 14px 16px;
          background: var(--wv-cream);
          border-radius: 18px;
          box-shadow: 0 8px 24px rgba(39, 50, 72, 0.18);
          animation: mphActionsIn 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
          text-align: left;
        }

        .mph-clear {
          justify-self: start;
          background: transparent;
          border: none;
          color: var(--wv-cadet);
          opacity: 0.55;
          font-size: 13px;
          font-weight: 600;
          padding: 6px 8px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .mph-clear:hover { opacity: 0.85; }
        .mph-clear:focus-visible {
          outline: 3px solid var(--color-focus);
          outline-offset: 2px;
          border-radius: 6px;
        }

        .mph-count {
          color: var(--wv-cadet);
          font-weight: 700;
          font-size: 14px;
        }

        .mph-cta-stack {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        button.mph-primary:not([type="submit"]):not(.wv-header-signout) {
          background: var(--wv-redwood);
          color: var(--wv-white);
          border: none;
          border-radius: 14px;
          padding: 12px 20px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(177, 80, 67, 0.28);
          transition: scale 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow 140ms ease;
        }
        button.mph-primary:not([type="submit"]):not(.wv-header-signout):hover {
          scale: 1.03;
          box-shadow: 0 6px 18px rgba(177, 80, 67, 0.34);
        }
        button.mph-primary:not([type="submit"]):not(.wv-header-signout):active {
          scale: 0.97;
        }
        button.mph-primary:not([type="submit"]):not(.wv-header-signout):focus-visible {
          outline: 3px solid var(--color-focus);
          outline-offset: 3px;
        }

        button.mph-secondary:not([type="submit"]):not(.wv-header-signout) {
          background: transparent;
          color: var(--wv-cadet);
          border: none;
          font-weight: 600;
          font-size: 12px;
          padding: 4px 6px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          opacity: 0.7;
        }
        button.mph-secondary:not([type="submit"]):not(.wv-header-signout):hover {
          opacity: 1;
        }
        button.mph-secondary:not([type="submit"]):not(.wv-header-signout):focus-visible {
          outline: 3px solid var(--color-focus);
          outline-offset: 2px;
          border-radius: 6px;
        }

        @media (max-width: 520px) {
          .mph-actions {
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "count count"
              "clear ctas";
          }
          .mph-count { grid-area: count; }
          .mph-clear { grid-area: clear; justify-self: start; }
          .mph-cta-stack { grid-area: ctas; align-items: flex-end; }
        }

        @keyframes mphIn {
          from { opacity: 0; translate: 0 8px; scale: 0.85; }
          to   { opacity: 1; translate: 0 0;   scale: 1; }
        }

        /* rotate-only wobble leaves translate + scale free for hover/active */
        @keyframes mphWobble {
          0%, 100% { rotate: var(--rest-rotation); }
          50%      { rotate: calc(var(--rest-rotation) + 1.2deg); }
        }

        /* 180ms spring bounce on tile tap — composes over the wobble
           via transform (it's otherwise untouched by the tile). */
        @keyframes mphTap {
          0%   { transform: scale(1); }
          40%  { transform: scale(0.88); }
          100% { transform: scale(1); }
        }

        @keyframes mphActionsIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          button.mph-tile:not([type="submit"]):not(.wv-header-signout) {
            animation: none;
            transition: background 120ms ease, border-color 120ms ease;
            transform: none;
            rotate: var(--rest-rotation);
            translate: 0 0;
            scale: 1;
          }
          button.mph-tile:not([type="submit"]):not(.wv-header-signout):hover {
            translate: 0 0;
            scale: 1;
          }
          button.mph-tile:not([type="submit"]):not(.wv-header-signout):active {
            scale: 1;
            animation: none;
          }
          .mph-tile--on .mph-accent-chip { transform: none; }
          .mph-actions { animation: none; }
        }
      `}</style>
    </div>
  );
}
