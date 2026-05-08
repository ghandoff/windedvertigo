"use client";
import { useState, useCallback } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #28 — Breath (v2)
 *
 * All logos breathe together — a single synchronized opacity pulse
 * (0.35 → 0.88 → 0.35, 3.5s) that's clearly visible without being distracting.
 * Logos shown as white silhouettes via CSS filter to match tide variant.
 * Current partners glow brighter at full breath; past partners dimmer.
 *
 * Interaction:
 * - Tap/click any logo to hold it at full opacity while others breathe.
 * - A visible pause/play button stops the animation entirely.
 *
 * WCAG:
 * - 2.2.2: always-visible pause button (required for auto-playing loop)
 * - prefers-reduced-motion: animation off, logos static at 0.70 opacity,
 *   pause button hidden (nothing to pause)
 * - sr-only list for screen readers (logo alt text also provided)
 */

export function CollabBreath() {
  const [paused, setPaused]   = useState(false);
  const [heldSet, setHeldSet] = useState<Set<number>>(new Set());

  const toggleHold = useCallback((i: number) => {
    setHeldSet(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const togglePause = useCallback(() => setPaused(p => !p), []);

  return (
    <section
      className="collab-variant collab-breath"
      aria-label="organisations we play with"
    >
      <p className="collab-variant-label">organisations we play with</p>

      {/* Pause button — always visible, WCAG 2.2.2 */}
      <div className="breath-controls">
        <button
          className={`breath-pause-btn${paused ? " breath-pause-btn--paused" : ""}`}
          onClick={togglePause}
          aria-label={paused ? "resume breathing animation" : "pause breathing animation"}
          aria-pressed={paused}
        >
          {paused ? "▶ resume" : "⏸ pause"}
        </button>
      </div>

      {/* Logos — breathing together */}
      <ul
        className={`breath-logos${paused ? " breath-logos--paused" : ""}`}
        aria-label="collaborating organisations"
      >
        {COLLABORATORS.map((c, i) => {
          const held = heldSet.has(i);
          return (
            <li key={c.name}>
              <button
                className={[
                  "breath-icon",
                  c.current ? "breath-icon--current" : "breath-icon--past",
                  held ? "breath-icon--held" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => toggleHold(i)}
                aria-pressed={held}
                aria-label={`${c.name}${c.current ? " — active collaborator" : ""}`}
              >
                {c.logoPath ? (
                  <img
                    src={c.logoPath}
                    alt={c.name}
                    className="breath-logo-img"
                  />
                ) : (
                  <span className="breath-logo-text">{c.name}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
