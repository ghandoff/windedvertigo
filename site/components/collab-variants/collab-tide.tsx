"use client";
import { useState } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #13 — Slow Tide
 *
 * Each item bobs vertically at its own frequency and phase offset — like
 * objects floating on water, each at a slightly different swell.
 * Uses pure CSS custom properties + @keyframes so it works without JS.
 *
 * Logo images shown at a consistent visual weight via object-contain in a
 * fixed square box — eliminates the size-disparity issue entirely.
 *
 * WCAG:
 * - 2.2.2: visible pause button (auto-playing loop)
 * - prefers-reduced-motion: stops all animation (items sit statically)
 */

export function CollabTide() {
  const [paused, setPaused] = useState(false);

  return (
    <section className="collab-variant collab-tide" aria-label="organisations we play with">
      <p className="collab-variant-label">organisations we play with</p>

      <div className="tide-controls">
        <button
          className={`tide-pause-btn${paused ? " tide-pause-btn--paused" : ""}`}
          onClick={() => setPaused(p => !p)}
          aria-label={paused ? "resume animation" : "pause animation"}
          aria-pressed={paused}
        >
          {paused ? "▶ resume" : "⏸ pause"}
        </button>
      </div>

      <div className={`collab-tide-sea${paused ? " collab-tide-sea--paused" : ""}`}>
        {COLLABORATORS.map((c, i) => {
          const duration  = 3.2 + (i % 7) * 0.55;
          const delay     = -(i * 0.8);
          const amplitude = 6 + (i % 4) * 3;
          return (
            <div
              key={c.name}
              className={`collab-tide-item${c.current ? " tide-current" : ""}`}
              style={{
                "--tide-duration":  `${duration}s`,
                "--tide-delay":     `${delay}s`,
                "--tide-amplitude": `${amplitude}px`,
              } as React.CSSProperties}
            >
              {c.logoPath ? (
                <div className="tide-logo-box">
                  <img
                    src={c.logoPath}
                    alt={c.name}
                    className="tide-logo"
                    loading="lazy"
                  />
                </div>
              ) : (
                <span className="tide-name">{c.name}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
