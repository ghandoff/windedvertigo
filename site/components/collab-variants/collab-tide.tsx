"use client";
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
 * UDL: prefers-reduced-motion stops all animation (items sit statically).
 */

export function CollabTide() {
  return (
    <section className="collab-variant collab-tide" aria-label="organisations we play with">
      <p className="collab-variant-label">organisations we play with</p>
      <div className="collab-tide-sea">
        {COLLABORATORS.map((c, i) => {
          // Each item gets its own duration + delay for an organic, desynchronised feel
          const duration = 3.2 + (i % 7) * 0.55;   // 3.2s – 7.05s
          const delay    = -(i * 0.8);              // negative delay = pre-started
          const amplitude = 6 + (i % 4) * 3;        // 6–15px vertical travel
          return (
            <div
              key={c.name}
              className={`collab-tide-item${c.current ? " tide-current" : ""}`}
              style={{
                "--tide-duration": `${duration}s`,
                "--tide-delay": `${delay}s`,
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
