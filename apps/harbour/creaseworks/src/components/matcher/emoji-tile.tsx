"use client";

/**
 * EmojiTile — big, tappable, child-first selection tile.
 *
 * Kid refresh (2026-04): cream tiles on the light find-phase bg.
 * Irregular squircle corners, deterministic accent rotation, idle
 * wobble, tap-squish — matching MaterialPickerHero vocabulary.
 *
 * Icon-surface priority (first non-null wins):
 *   1. characterName   — render the harbour cast via <CharacterSlot>
 *   2. emojiSrc        — PNG path (legacy material icons)
 *   3. emoji           — unicode fallback
 *
 * Character rendering is the preferred surface: a single shared cast
 * (Cord, Jugs, Twig, Swatch, Crate, Mud, Drip) means the matcher speaks
 * the same visual language as the landing hero. Call sites resolve the
 * character themselves (via resolveCharacterFromForm) so EmojiTile stays
 * decoupled from Material data.
 */

import { useRef, useCallback } from "react";
import CharacterSlot, { type CharacterName } from "@windedvertigo/characters";
import { useCharacterVariant } from "@windedvertigo/characters/variant-context";

export type EmojiTileSize = "sm" | "md" | "lg" | "xl";

export interface EmojiTileProps {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  accentColor?: string;
  size?: EmojiTileSize;
  showLabel?: boolean;
  disabled?: boolean;
  /** position index — drives squircle corner pattern, tilt, wobble phase */
  index?: number;
  badge?: string;
  emojiSrc?: string;
  /**
   * Character cast host. When set, overrides emoji/emojiSrc and renders
   * the character's kid-mode base pose. Resolve via
   * resolveCharacterFromForm(material.form_primary, material.title) at
   * the call site. null/undefined → falls through to emojiSrc → emoji.
   */
  characterName?: CharacterName | null;
  /**
   * When true, the tile fills its grid cell width instead of the fixed
   * SIZE_CONFIG width. `cfg.tile` becomes the min-height floor (so the
   * tile stays tall even if the label is short). Used by the classic
   * picker's continuous size-sorted scroll where 2–3 cols fill the row.
   */
  fluid?: boolean;
}

const SIZE_CONFIG: Record<EmojiTileSize, {
  tile: number;
  emoji: string;
  imgPx: number;
  label: string;
  gap: number;
}> = {
  sm: { tile: 80,  emoji: "2.5rem", imgPx: 40,  label: "0.688rem", gap: 2 },
  md: { tile: 96,  emoji: "3rem",   imgPx: 48,  label: "0.688rem", gap: 2 },
  lg: { tile: 116, emoji: "3.5rem", imgPx: 56,  label: "0.688rem", gap: 3 },
  // xl — designed for fluid grids where the tile fills a grid cell.
  // tile=168 is the min-height floor; cfg.tile is the tile width only
  // when fluid=false. Character/icon area at 120px is big enough for
  // SVG detail to read comfortably at arm's length.
  xl: { tile: 168, emoji: "5rem",   imgPx: 120, label: "0.9375rem", gap: 8 },
};

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

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function EmojiTile({
  emoji, label, selected, onClick, accentColor,
  size = "md", showLabel = true, disabled = false,
  index = 0, badge, emojiSrc, characterName, fluid = false,
}: EmojiTileProps) {
  const cfg = SIZE_CONFIG[size];
  const tapRef = useRef<HTMLButtonElement>(null);
  // ambient register from the root-layout cookie-bootstrapped provider —
  // kid by default, grownup when the user has flipped the toggle in
  // /profile accessibility. Passed explicitly to CharacterSlot so
  // CharacterSlot itself stays hook-free (server-safe).
  const characterVariant = useCharacterVariant();

  const accent = accentColor ?? ACCENTS[index % ACCENTS.length];
  const corners = CORNERS[index % CORNERS.length];
  const restRot = index % 4 === 0 ? -2 : index % 4 === 3 ? 2 : 0;
  const wobDelay = `${(index * 0.37) % 3.6}s`;
  const inDelay = `${index * 50}ms`;

  const handleClick = useCallback(() => {
    if (disabled) return;
    onClick();
    const el = tapRef.current;
    if (!el) return;
    el.classList.remove("et-tap");
    void el.offsetWidth;
    el.classList.add("et-tap");
  }, [disabled, onClick]);

  return (
    <button
      ref={tapRef}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      data-selected={selected || undefined}
      className="et-tile relative flex flex-col items-center justify-center select-none"
      style={{
        // fluid=true: tile fills its grid cell, cfg.tile becomes the min-height floor.
        // fluid=false: tile is a fixed square (legacy behavior for contexts/slots grids).
        width: fluid ? "100%" : cfg.tile,
        minHeight: cfg.tile,
        gap: cfg.gap,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent",
        borderRadius: corners,  // inline to sidestep global button border-radius rule
        ["--accent" as string]: accent,
        ["--corners" as string]: corners,
        ["--rest-rotation" as string]: `${restRot}deg`,
        ["--wobble-delay" as string]: wobDelay,
        ["--in-delay" as string]: inDelay,
      }}
    >
      {badge ? (
        <span
          className="absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 font-bold leading-none"
          style={{
            fontSize: "0.5rem",
            backgroundColor: accent,
            color: "var(--wv-cadet)",
            letterSpacing: "0.04em",
          }}
        >
          {badge}
        </span>
      ) : (
        <span className="et-accent-chip" aria-hidden="true" />
      )}

      {characterName ? (
        <span
          className="et-icon inline-flex items-center justify-center"
          aria-hidden="true"
          style={{ width: cfg.imgPx, height: cfg.imgPx }}
        >
          {/* animate={false} — EmojiTile owns the wobble via .et-tile, so
              the character's self-wobble would double-animate.
              variant={characterVariant} — from the ambient provider so
              flipping kid/grownup at /profile propagates instantly.   */}
          <CharacterSlot
            character={characterName}
            size={cfg.imgPx}
            animate={false}
            variant={characterVariant}
          />
        </span>
      ) : emojiSrc ? (
        <img
          src={emojiSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="object-contain et-icon"
          style={{ width: cfg.imgPx, height: cfg.imgPx }}
        />
      ) : (
        <span
          className="leading-none et-icon"
          aria-hidden="true"
          style={{ fontSize: cfg.emoji }}
        >
          {emoji}
        </span>
      )}

      {showLabel && (
        <span
          className="et-label text-center w-full px-1"
          style={{
            fontSize: cfg.label,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      )}

      {selected && (
        <span
          className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
          style={{
            width: size === "sm" ? 16 : 20,
            height: size === "sm" ? 16 : 20,
            backgroundColor: accent,
            color: "var(--wv-cadet)",
            fontSize: size === "sm" ? "0.55rem" : "0.65rem",
            animation: `etCheckPop 300ms ${SPRING}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
          aria-hidden="true"
        >
          ✓
        </span>
      )}

      <style>{`
        .et-tile {
          /* transform: none clears any outer transform so our individual
             scale/rotate/translate properties aren't composed with the
             globals.css button:active rule (transform: scale(0.95)).     */
          transform: none;
          background: var(--wv-cream);
          border: 1px solid rgba(39, 50, 72, 0.08);
          box-shadow: 0 2px 0 rgba(39, 50, 72, 0.08);
          rotate: var(--rest-rotation);
          translate: 0 0;
          scale: 1;
          transition:
            translate 180ms ${SPRING},
            scale 180ms ${SPRING},
            background 140ms ease,
            box-shadow 180ms ease;
          animation:
            etIn 420ms ${SPRING} var(--in-delay) both,
            etWobble 3.6s ease-in-out var(--wobble-delay) infinite;
        }
        .et-tile:hover:not(:disabled) {
          transform: none;
          translate: 0 -2px;
          scale: 1.04;
          box-shadow: 0 6px 0 rgba(39, 50, 72, 0.1), 0 0 0 2px var(--accent);
        }
        .et-tile:active:not(:disabled) {
          transform: none;
          scale: 0.92;
          background: var(--accent);
          transition: scale 80ms ease, background 80ms ease;
        }
        .et-tile[data-selected] {
          background: color-mix(in srgb, var(--accent) 14%, var(--wv-cream));
          border: 2px solid var(--accent);
          box-shadow: 0 2px 0 rgba(39, 50, 72, 0.06), 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
          scale: 1.04;
        }
        .et-tile:focus-visible {
          outline: 3px solid var(--color-focus);
          outline-offset: 3px;
        }
        .et-accent-chip {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
        }
        .et-tile[data-selected] .et-icon {
          transform: scale(1.1);
          transition: transform 220ms ${SPRING};
        }
        .et-tile .et-icon {
          transition: transform 220ms ${SPRING};
        }
        .et-label {
          font-family: var(--font-nunito), ui-sans-serif, system-ui, sans-serif;
          font-weight: 800;
          letter-spacing: 0.01em;
          color: var(--wv-cadet);
          opacity: 0.7;
          transition: opacity 180ms ease;
        }
        .et-tile[data-selected] .et-label { opacity: 1; }
        .et-tap { animation: etTap 350ms ${SPRING} !important; }

        @keyframes etIn {
          from { opacity: 0; translate: 0 8px; scale: 0.85; }
          to   { opacity: 1; translate: 0 0; scale: 1; }
        }
        @keyframes etWobble {
          0%, 100% { rotate: var(--rest-rotation); }
          50%      { rotate: calc(var(--rest-rotation) + 1.2deg); }
        }
        @keyframes etTap {
          0%   { scale: 1; }
          30%  { scale: 1.12; }
          60%  { scale: 0.94; }
          100% { scale: 1; }
        }
        @keyframes etCheckPop {
          from { transform: scale(0); }
          60%  { transform: scale(1.3); }
          to   { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .et-tile {
            animation: none;
            transition: background 120ms ease;
            rotate: 0deg; translate: 0 0; scale: 1;
          }
          .et-tile:hover:not(:disabled) { translate: 0 0; scale: 1; }
          .et-tile:active:not(:disabled) { scale: 1; }
          .et-tile[data-selected] { scale: 1; }
          .et-tap { animation: none !important; }
          @keyframes etCheckPop { from, to { transform: scale(1); } }
        }
      `}</style>
    </button>
  );
}
