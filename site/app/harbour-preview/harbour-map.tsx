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
 *
 * Interaction model: tap/click always opens a persistent fixed-bottom
 * card (app name + tagline + "open app" link). No hover-tooltip — this
 * gives mobile and desktop the same behaviour. The card closes on
 * Escape, a close-button click, or a click outside the card.
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

interface CardState {
  slug:    string;
  label:   string;
  tagline: string;
  href:    string;
  status:  "live" | "coming-soon";
}

export function HarbourMap() {
  const [card, setCard] = useState<CardState | null>(null);
  const cardRef  = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const openCard = useCallback((boat: Boat) => {
    setCard({
      slug:    boat.slug,
      label:   boat.label,
      tagline: boat.tagline,
      href:    boat.href,
      status:  boat.status,
    });
  }, []);

  const closeCard = useCallback(() => setCard(null), []);

  /* ── Escape key ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCard(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [card, closeCard]);

  /* ── click outside the card ─────────────────────────────────────── */
  useEffect(() => {
    if (!card) return;
    const onPointerDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        closeCard();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [card, closeCard]);

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
            const isLive    = boat.status === "live";
            const fill      = isLive ? COLOURS.boat      : COLOURS.boatComing;
            const stroke    = isLive ? COLOURS.boatStroke : COLOURS.boatComing;
            const styleVars = { ["--boat-index" as string]: String(index) } as React.CSSProperties;

            // ── custom artwork (svgPair / svgHref) or placeholder ellipse ──
            const hasCustomArt = !!(boat.svgPair || boat.svgHref);
            const svgH  = boat.svgHeight ?? boat.ry * 2;
            const svgW  = Math.round(svgH * (boat.svgAspect ?? 1));

            const boatVisual = (
              <g
                className={`${styles.boat} ${!isLive ? styles.boatComing : ""}`}
                style={styleVars}
                data-boat={boat.slug}
                onClick={(e) => {
                  e.preventDefault();
                  // Toggle: tapping the active boat closes the card
                  if (card?.slug === boat.slug) {
                    closeCard();
                  } else {
                    openCard(boat);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={isLive ? `${boat.label} — ${boat.tagline}` : `${boat.label} — coming soon`}
                aria-expanded={card?.slug === boat.slug}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (card?.slug === boat.slug) {
                      closeCard();
                    } else {
                      openCard(boat);
                    }
                  }
                }}
              >
                {hasCustomArt ? (
                  /* ── Payton's custom SVG artwork ─────────────────────── */
                  boat.svgPair ? (
                    /* side-by-side pair, centred on cx/cy */
                    <>
                      <image
                        href={boat.svgPair[0]}
                        x={boat.cx - svgW}
                        y={boat.cy - svgH / 2}
                        width={svgW}
                        height={svgH}
                        preserveAspectRatio="xMidYMid meet"
                      />
                      <image
                        href={boat.svgPair[1]}
                        x={boat.cx}
                        y={boat.cy - svgH / 2}
                        width={svgW}
                        height={svgH}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </>
                  ) : (
                    /* single image, centred on cx/cy */
                    <image
                      href={boat.svgHref}
                      x={boat.cx - svgW / 2}
                      y={boat.cy - svgH / 2}
                      width={svgW}
                      height={svgH}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )
                ) : (
                  /* ── placeholder ellipse + label ──────────────────────── */
                  <>
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
                  </>
                )}
              </g>
            );

            return (
              <g key={boat.slug} role="none">
                {boatVisual}
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── fixed-bottom card ────────────────────────────────────────── */}
      {card && (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="false"
          aria-label={card.label}
          className={`${styles.boatCard} ${card.status === "coming-soon" ? styles.boatCardComing : ""}`}
        >
          <div className={styles.boatCardBody}>
            <div className={styles.boatCardText}>
              <p className={styles.boatCardName}>{card.label}</p>
              <p className={styles.boatCardTagline}>{card.tagline}</p>
            </div>
            {card.status === "live" ? (
              <a href={card.href} className={styles.boatCardLink}>
                open app →
              </a>
            ) : (
              <span className={styles.boatCardBadge}>coming soon</span>
            )}
          </div>
          <button
            className={styles.boatCardClose}
            onClick={closeCard}
            aria-label="close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
