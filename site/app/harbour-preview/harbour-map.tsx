"use client";

/**
 * harbour-preview map — the SVG portrait.
 *
 * One inline <svg> with two layers inside a 1000×2000 viewBox:
 *   1. landscape <image> elements — Left-Bank and Right-bank SVGs produced
 *      by Payton, served from /public/harbour-preview/
 *   2. boats <g> — eight interactive red-oval placeholders; Payton is
 *      producing per-boat SVG artwork that will slot in here next.
 *
 * The water background colour (#3b5577) and the south-bank1.svg panorama
 * live on the .mapWrapper div as CSS background layers, NOT in the SVG.
 * This is necessary because the south bank needs CSS `background-position:
 * bottom right` behaviour — anchored to the bottom-right corner at a fixed
 * height so the visible portion expands as the viewport widens (desktop)
 * and contracts to nearly nothing on mobile. That kind of responsive
 * positioning is impossible inside SVG coordinate space where everything
 * scales proportionally with the viewBox.
 *
 * The wrapper is `width: 100%` with no max-width, so the SVG fills
 * whatever space the page gives it; aspect-ratio is preserved by the
 * viewBox, so on a 1440px desktop the rendered height is ~2880px and
 * the user scrolls down through the harbour from horizon to south shore.
 *
 * Boat data lives in ./boats.ts — nudge cx/cy positions there, not here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { BOATS, type Boat } from "./boats";
import styles from "./harbour-map.module.css";

// Brand palette — boat layer only.
// Water colour lives in harbour-map.module.css (.mapWrapper background-color)
// so it can coexist with the south-bank CSS background-image layer.
const COLOURS = {
  boat: "#cb7858",          // sienna for live boats
  boatComing: "#7a5147",    // muted redwood for coming-soon boats
  boatStroke: "#b15043",    // redwood outline on live boats
  text: "#ffffff",          // labels on dark fills
} as const;

interface TooltipState {
  slug: string;
  tagline: string;
  status: "live" | "coming-soon";
  // Anchor coords in client/CSS pixels — set by getBoundingClientRect
  // on the bounding rect of the active boat.
  x: number;
  y: number;
}

export function HarbourMap() {
  // Single source of truth for "which boat's tooltip is showing." Null
  // when nothing is active. Both hover and focus drive this.
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /** Compute tooltip anchor from the target element's bounding box. */
  const openTooltip = useCallback((boat: Boat, target: SVGElement) => {
    const rect = target.getBoundingClientRect();
    setTooltip({
      slug: boat.slug,
      tagline: boat.tagline,
      status: boat.status,
      // Anchor above the boat's top-centre. CSS transform handles
      // centring relative to the tooltip's own width.
      x: rect.left + rect.width / 2 + window.scrollX,
      y: rect.top + window.scrollY,
    });
  }, []);

  const closeTooltip = useCallback(() => setTooltip(null), []);

  // ESC closes the tooltip (a11y).
  useEffect(() => {
    if (!tooltip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTooltip();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tooltip, closeTooltip]);

  // Tap-outside on mobile (no hover) closes the tooltip.
  useEffect(() => {
    if (!tooltip) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (svgRef.current && !svgRef.current.contains(t)) {
        closeTooltip();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [tooltip, closeTooltip]);

  return (
    <div className={styles.mapWrapper}>
      <svg
        ref={svgRef}
        viewBox="0 0 1000 2000"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="harbour map — click a boat to open an app"
        className={styles.map}
      >
        {/* All three banks (Left-Bank, Right-bank, south-bank1) are CSS
            backgrounds on .mapWrapper — see harbour-map.module.css.
            Using CSS backgrounds lets us set fixed pixel heights so the
            banks don't grow as the SVG scales with viewport width.

            When Payton adds per-boat SVGs, swap the placeholder ellipses
            in <g data-boats> for <image> elements anchored at each boat's
            existing cx / cy. boats.ts coordinate data stays the same. */}

        {/* ── layer 5: boats (the interactive layer) ─────────────── */}
        <g data-boats>
          {BOATS.map((boat, index) => {
            const isLive = boat.status === "live";
            const fill = isLive ? COLOURS.boat : COLOURS.boatComing;
            const stroke = isLive ? COLOURS.boatStroke : COLOURS.boatComing;
            // CSS variable used by the bob @keyframes (staggers each boat
            // so the harbour breathes as a wave, not in lockstep).
            const styleVars = {
              ["--boat-index" as string]: String(index),
            } as React.CSSProperties;

            const boatVisual = (
              <g
                className={`${styles.boat} ${!isLive ? styles.boatComing : ""}`}
                style={styleVars}
                data-boat={boat.slug}
                onMouseEnter={(e) => openTooltip(boat, e.currentTarget)}
                onMouseLeave={closeTooltip}
                onFocus={(e) => openTooltip(boat, e.currentTarget)}
                onBlur={closeTooltip}
                onClick={(e) => {
                  // Mobile: tap toggles tooltip BEFORE navigation. Since
                  // the visual is wrapped in <a> for live boats, clicking
                  // again on a boat that's already showing its tooltip
                  // navigates. First-tap shows the tooltip and prevents
                  // navigation; second-tap navigates.
                  if (
                    !window.matchMedia("(hover: hover)").matches &&
                    tooltip?.slug !== boat.slug
                  ) {
                    e.preventDefault();
                    openTooltip(boat, e.currentTarget as SVGElement);
                  }
                }}
                tabIndex={isLive ? 0 : undefined}
                aria-describedby={`tip-${boat.slug}`}
              >
                <ellipse
                  cx={boat.cx}
                  cy={boat.cy}
                  rx={boat.rx}
                  ry={boat.ry}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isLive ? "3" : "2"}
                  strokeDasharray={isLive ? undefined : "8 6"}
                  opacity={isLive ? 1 : 0.85}
                />
                <text
                  x={boat.cx}
                  y={boat.cy + 8}
                  fontSize="26"
                  fontWeight="700"
                  fill={COLOURS.text}
                  textAnchor="middle"
                  fontFamily="Inter, system-ui, sans-serif"
                  pointerEvents="none"
                >
                  {boat.label}
                </text>
              </g>
            );

            // Live boats: SVG <a> wraps the group so the browser handles
            // middle-click / Cmd-click / right-click "open in new tab"
            // for free. Coming-soon boats: same visual, no <a> wrapper,
            // so clicks don't navigate — but the tooltip still works
            // and announces "coming soon".
            return isLive ? (
              <a key={boat.slug} href={boat.href} aria-label={`${boat.label} — ${boat.tagline}`}>
                {boatVisual}
              </a>
            ) : (
              <g key={boat.slug} role="group" aria-label={`${boat.label} — coming soon`}>
                {boatVisual}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip — a positioned div anchored above the active boat.
          Rendered outside the SVG so it can extend beyond the viewBox
          on edge boats, and so its CSS isn't subject to SVG's text
          rendering quirks. */}
      {tooltip && (
        <div
          id={`tip-${tooltip.slug}`}
          role="tooltip"
          className={`${styles.tooltip} ${tooltip.status === "coming-soon" ? styles.tooltipComing : ""}`}
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          {tooltip.status === "coming-soon" && (
            <span className={styles.tooltipBadge}>coming soon</span>
          )}
          <p className={styles.tooltipText}>{tooltip.tagline}</p>
        </div>
      )}
    </div>
  );
}
