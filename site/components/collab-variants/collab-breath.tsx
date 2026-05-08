"use client";
import { useState, useCallback } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #28 — Breath
 *
 * All names breathe together — a single synchronized opacity pulse
 * (0.60 → 0.90 → 0.60, 8s) that mimics slow collective breathing.
 * Names are in a centered flex-wrap. Current partners render in
 * champagne; past partners in dim white.
 *
 * Interaction:
 * - Tap/click any name to "hold" it at full opacity — it glows while
 *   the rest of the group continues breathing.
 * - A visible pause/play button stops the animation entirely.
 *
 * WCAG notes:
 * - Auto-playing loop → pause button is REQUIRED (2.2.2)
 * - Pause button is always visible, not just on hover
 * - prefers-reduced-motion: animation off, names static at 0.72 opacity
 * - Held names: aria-pressed on each button-like name
 * - Screen reader: section aria-label + live region for held name
 */

export function CollabBreath() {
  const [paused, setPaused] = useState(false);
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

      {/* Names — breathing together */}
      <ul
        className={`breath-names${paused ? " breath-names--paused" : ""}`}
        aria-label="collaborating organisations"
      >
        {COLLABORATORS.map((c, i) => {
          const held = heldSet.has(i);
          return (
            <li key={c.name}>
              <button
                className={[
                  "breath-name",
                  c.current ? "breath-name--current" : "breath-name--past",
                  held ? "breath-name--held" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => toggleHold(i)}
                aria-pressed={held}
                aria-label={`${c.name}${c.current ? " — active collaborator" : ""}`}
              >
                {c.name}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Screen-reader accessible summary */}
      <p className="visually-hidden">
        {Array.from(heldSet).map(i => COLLABORATORS[i].name).join(", ") || "tap a name to hold it at full visibility"}
      </p>
    </section>
  );
}
