"use client";

/**
 * harbour-preview map.
 *
 * Layout: one <div> with Fruit's exact CSS — height: 1300px, three
 * background-image layers (Left-Bank, Right-bank, south-bank1).
 * The boats float on an absolutely-positioned <svg> that fills the div.
 *
 * SVG viewBox: 0 0 1000 1300  (matches the 1300px fixed height;
 * x-axis stays at 1000 units so cx values in boats.ts are unchanged).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { BOATS, type Boat } from "./boats";
import styles from "./harbour-map.module.css";

const COLOURS = {
  boat:        "#cb7858",
  boatComing:  "#7a5147",
  boatStroke:  "#b15043",
  text:        "#ffffff",
} as const;

interface TooltipState {
  slug:    string;
  tagline: string;
  status:  "live" | "coming-soon";
  x:       number;
  y:       number;
}

export function HarbourMap() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const openTooltip = useCallback((boat: Boat, target: SVGElement) => {
    const rect = target.getBoundingClientRect();
    setTooltip({
      slug:    boat.slug,
      tagline: boat.tagline,
      status:  boat.status,
      x: rect.left + rect.width  / 2 + window.scrollX,
      y: rect.top                    + window.scrollY,
    });
  }, []);

  const closeTooltip = useCallback(() => setTooltip(null), []);

  useEffect(() => {
    if (!tooltip) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeTooltip(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tooltip, closeTooltip]);

  useEffect(() => {
    if (!tooltip) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closeTooltip();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [tooltip, closeTooltip]);

  return (
    <div ref={wrapperRef} className={styles.mapWrapper}>
      {/* Boats — absolutely-positioned SVG overlay.
          viewBox 0 0 1000 1300 matches the 1300px fixed container height.
          The CSS backgrounds (banks) are behind this layer. */}
      <svg
        viewBox="0 0 1000 1300"
        preserveAspectRatio="none"
        role="img"
        aria-label="harbour map — click a boat to open an app"
        className={styles.boatsLayer}
      >
        <g data-boats>
          {BOATS.map((boat, index) => {
            const isLive   = boat.status === "live";
            const fill     = isLive ? COLOURS.boat   : COLOURS.boatComing;
            const stroke   = isLive ? COLOURS.boatStroke : COLOURS.boatComing;
            const styleVars = { ["--boat-index" as string]: String(index) } as React.CSSProperties;

            const boatVisual = (
              <g
                className={`${styles.boat} ${!isLive ? styles.boatComing : ""}`}
                style={styleVars}
                data-boat={boat.slug}
                onMouseEnter={(e) => openTooltip(boat, e.currentTarget)}
                onMouseLeave={closeTooltip}
                onFocus={(e)    => openTooltip(boat, e.currentTarget)}
                onBlur={closeTooltip}
                onClick={(e) => {
                  if (!window.matchMedia("(hover: hover)").matches && tooltip?.slug !== boat.slug) {
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

      {tooltip && (
        <div
          id={`tip-${tooltip.slug}`}
          role="tooltip"
          className={`${styles.tooltip} ${tooltip.status === "coming-soon" ? styles.tooltipComing : ""}`}
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
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
