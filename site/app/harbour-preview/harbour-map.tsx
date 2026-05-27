"use client";

/**
 * harbour-preview map.
 *
 * Layout: .mapWrapper is a fixed 1300px-tall div with three CSS
 * background-image layers (Left-Bank, Right-bank, south-bank1).
 *
 * Boats are absolutely-positioned HTML elements — NOT an SVG overlay —
 * so their sizes are in CSS pixels from the start and never stretch
 * with the viewport.  Positions use percentage-based left/top derived
 * from the 0–1000 × 0–1300 design coordinate space:
 *   left = cx / 1000 * 100%
 *   top  = cy / 1300 * 100%
 * Centering on that point uses negative margins (not transform, so
 * the bob CSS animation can use transform freely).
 *
 * Coming-soon boats (depth.chart, crease.works) are rendered as inline
 * SVGs with explicit pixel viewBoxes — also no stretch.
 *
 * Interaction: tap/click opens a persistent fixed-bottom card with app
 * name, tagline, and an "open app" link.  Escape, close button, or
 * clicking outside the card all dismiss it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { BOATS, type Boat } from "./boats";
import styles from "./harbour-map.module.css";

const COLOURS = {
  boatComing:  "#7a5147",
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
  const cardRef    = useRef<HTMLDivElement>(null);
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

      {BOATS.map((boat, index) => {
        const isLive = boat.status === "live";

        // ── dimensions in CSS pixels ────────────────────────────────
        // BOAT_SCALE lets you resize the whole fleet in one place.
        const BOAT_SCALE = 0.5;
        const svgH = Math.round((boat.svgHeight ?? boat.ry * 2) * BOAT_SCALE);
        const svgW = (boat.svgHref || boat.svgPair)
          ? Math.round(svgH * (boat.svgAspect ?? 1))
          : Math.round(boat.rx * 2 * BOAT_SCALE); // oval width = diameter

        // ── absolute position: map 0–1000/0–1300 coords → percentages.
        // Negative margins centre the element on the coordinate point
        // without using `transform`, so the bob animation can use
        // transform freely.
        const posStyle: React.CSSProperties = {
          left:       `${(boat.cx / 1000) * 100}%`,
          top:        `${(boat.cy / 1300) * 100}%`,
          width:      `${svgW}px`,
          height:     `${svgH}px`,
          marginLeft: `${-svgW / 2}px`,
          marginTop:  `${-svgH / 2}px`,
          ["--boat-index" as string]: String(index),
        };

        const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
          if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          if (card?.slug === boat.slug) {
            closeCard();
          } else {
            openCard(boat);
          }
        };

        return (
          <div
            key={boat.slug}
            className={`${styles.boat} ${!isLive ? styles.boatComing : ""}`}
            style={posStyle}
            data-boat={boat.slug}
            onClick={handleClick}
            onKeyDown={(e) => handleClick(e)}
            tabIndex={0}
            role="button"
            aria-label={
              isLive
                ? `${boat.label} — ${boat.tagline}`
                : `${boat.label} — coming soon`
            }
            aria-expanded={card?.slug === boat.slug}
          >
            {/* ── persistent name label ──────────────────────────── */}
            <span className={styles.boatLabel}>{boat.label}</span>

            {/* ── SVG image artwork ──────────────────────────────── */}
            {boat.svgPair ? (
              /* side-by-side pair */
              <div style={{ display: "flex", width: "100%", height: "100%" }}>
                <img
                  src={boat.svgPair[0]}
                  width={svgW / 2}
                  height={svgH}
                  alt=""
                  className={styles.boatImg}
                />
                <img
                  src={boat.svgPair[1]}
                  width={svgW / 2}
                  height={svgH}
                  alt=""
                  className={styles.boatImg}
                />
              </div>
            ) : boat.svgHref ? (
              /* single image */
              <img
                src={boat.svgHref}
                width={svgW}
                height={svgH}
                alt=""
                className={styles.boatImg}
              />
            ) : (
              /* ── coming-soon oval — inline SVG with explicit px viewBox */
              <svg
                width={svgW}
                height={svgH}
                viewBox={`0 0 ${svgW} ${svgH}`}
                style={{ display: "block" }}
                aria-hidden="true"
              >
                <ellipse
                  cx={svgW / 2}
                  cy={svgH / 2}
                  rx={svgW / 2 - 2}
                  ry={svgH / 2 - 2}
                  fill={COLOURS.boatComing}
                  stroke={COLOURS.boatComing}
                  strokeWidth="2"
                  strokeDasharray="8 6"
                  opacity={0.85}
                />
                <text
                  x={svgW / 2}
                  y={svgH / 2 + 8}
                  fontSize="22"
                  fontWeight="700"
                  fill={COLOURS.text}
                  textAnchor="middle"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {boat.label}
                </text>
              </svg>
            )}
          </div>
        );
      })}

      {/* ── one-shot tap nudge ────────────────────────────────────── */}
      <p className={styles.tapHint} aria-hidden="true">
        tap any boat to explore
      </p>

      {/* ── fixed-bottom card ───────────────────────────────────────  */}
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
