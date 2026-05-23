"use client";

/**
 * harbour-preview map — the SVG portrait.
 *
 * One inline <svg> renders six layers (water → shorelines → piers →
 * landmarks → boats → labels) inside a 1000×2000 viewBox. The wrapper
 * is `width: 100%` with no max-width, so the SVG fills whatever space
 * the page gives it; aspect-ratio is preserved by the viewBox, so on a
 * 1440px desktop the rendered height is ~2880px and the user scrolls
 * down through the harbour from horizon → family-play pier.
 *
 * Why inline SVG instead of <img src="harbour.svg"> + absolutely
 * positioned hit-targets: per-element click + ARIA + focus, no
 * overlay-DOM gymnastics, and the swap-in path for Fruit's real
 * background is just to drop in a single <image> underlay (TODO comment
 * below marks where).
 *
 * Boat data lives in ./boats.ts — that's where Maria/Payton/Garrett
 * will nudge positions during review. Don't hand-position in this file.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { BOATS, LANDMARKS, PIERS, type Boat } from "./boats";
import styles from "./harbour-map.module.css";

// Brand palette — also defined in site/styles/tokens.css; duplicated as
// constants here so the SVG fills are self-contained (CSS vars on an
// SVG <fill> attribute don't always evaluate at the right time on
// hydration).
const COLOURS = {
  water: "#3b5577",         // mid blue — the harbour basin
  waterShallow: "#4d6a8c",  // slightly lighter — fades into shoreline
  shore: "#5b8466",         // sage-green land
  shoreEdge: "#4a6e54",     // darker outline for the shoreline
  pier: "#9a7050",          // warm brown — pier decks
  pierEdge: "#6e4f3a",      // darker outline for piers
  boat: "#cb7858",          // sienna for live boats
  boatComing: "#7a5147",    // muted redwood for coming-soon boats
  boatStroke: "#b15043",    // redwood outline on live boats
  landmark: "#ffffff",      // white for landmark fills
  landmarkStroke: "#b15043", // redwood outline
  text: "#ffffff",          // labels on dark fills
  textOnLight: "#273248",   // labels on white/sand fills
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
        aria-label="harbour map — placeholder; click a boat to open an app"
        className={styles.map}
      >
        {/*
          TODO(Fruit): when the real background SVG ships, replace the
          rect/polygon/pier/landmark layers below with a single
          <image href="/harbour-preview/harbour-bg.svg" width="1000" height="2000" />
          and keep the boats group (`<g data-boats>`) at the bottom of
          the SVG so they paint on top.
        */}

        {/* ── layer 1: water ────────────────────────────────────── */}
        <rect x="0" y="0" width="1000" height="2000" fill={COLOURS.water} />

        {/* ── layer 2: shorelines (L + R) as polygons ───────────── */}
        {/* These polygons frame the central water column and narrow
            toward the bottom, mirroring the mockup. Each polygon walks
            the visible edge of the green land in clockwise order. */}
        <polygon
          fill={COLOURS.shore}
          stroke={COLOURS.shoreEdge}
          strokeWidth="3"
          points="
            0,640
            120,720
            140,900
            100,1100
            150,1380
            120,1640
            0,1800
            0,2000
            0,2000
            0,640
          "
        />
        <polygon
          fill={COLOURS.shore}
          stroke={COLOURS.shoreEdge}
          strokeWidth="3"
          points="
            1000,520
            850,580
            830,800
            900,990
            960,1180
            870,1380
            830,1620
            900,1820
            1000,1820
            1000,2000
            1000,520
          "
        />

        {/* ── layer 3: piers (brown rects with labels) ──────────── */}
        <g data-piers>
          {PIERS.map((p) => (
            <g key={p.id}>
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                rx="6"
                fill={COLOURS.pier}
                stroke={COLOURS.pierEdge}
                strokeWidth="3"
              />
              <text
                x={p.x + p.width / 2}
                y={p.y + p.height / 2 + 8}
                fontSize="22"
                fontWeight="700"
                fill={COLOURS.textOnLight}
                textAnchor="middle"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {p.label}
              </text>
            </g>
          ))}
        </g>

        {/* ── layer 4: landmarks (white shapes with labels) ────── */}
        <g data-landmarks>
          {LANDMARKS.map((lm) => {
            const labelY = lm.cy + (lm.shape === "rect" ? (lm.heightOverride ?? lm.size * 2) / 2 + 30 : lm.size + 30);
            const shapeEl =
              lm.shape === "circle" ? (
                <circle
                  cx={lm.cx}
                  cy={lm.cy}
                  r={lm.size}
                  fill={COLOURS.landmark}
                  stroke={COLOURS.landmarkStroke}
                  strokeWidth="3"
                />
              ) : (
                <rect
                  x={lm.cx - lm.size}
                  y={lm.cy - (lm.heightOverride ?? lm.size * 2) / 2}
                  width={lm.size * 2}
                  height={lm.heightOverride ?? lm.size * 2}
                  rx="4"
                  fill={COLOURS.landmark}
                  stroke={COLOURS.landmarkStroke}
                  strokeWidth="3"
                />
              );

            // If href ever gets set, wrap in <a> so the landmark becomes
            // a real link. Today they're all decorative.
            const inner = (
              <>
                {shapeEl}
                <text
                  x={lm.cx}
                  y={labelY}
                  fontSize="20"
                  fontWeight="700"
                  fill={COLOURS.landmarkStroke}
                  textAnchor="middle"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {lm.label}
                </text>
              </>
            );

            return lm.href ? (
              <a key={lm.id} href={lm.href}>
                {inner}
              </a>
            ) : (
              <g key={lm.id} aria-hidden="true">
                {inner}
              </g>
            );
          })}
        </g>

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
