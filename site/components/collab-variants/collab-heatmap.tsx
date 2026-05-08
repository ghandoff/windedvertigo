"use client";
import { useState } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #18 — Heat Map
 *
 * An abstract grid of squares. Each cell breathes independently — a slow
 * opacity animation at its own pace — like a thermal map or a field of
 * fireflies. Hovering reveals the organisation name + status.
 *
 * Current partners pulse warmer (champagne tones); past partners cooler
 * (white at lower opacity). The section rewards engagement without
 * demanding it.
 *
 * UDL: prefers-reduced-motion removes animation, cells remain at their
 * base opacity. Hover/focus still reveals names.
 */

export function CollabHeatmap() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="collab-variant collab-heatmap" aria-label="organisations we play with">
      <p className="collab-variant-label">organisations we play with</p>

      <div className="heatmap-grid" role="list">
        {COLLABORATORS.map((c, i) => {
          const duration = 2.5 + (i % 6) * 0.7;
          const delay    = -(i * 0.43);
          return (
            <div
              key={c.name}
              className={`heatmap-cell${c.current ? " heatmap-cell--current" : ""}`}
              style={{
                "--hm-duration": `${duration}s`,
                "--hm-delay": `${delay}s`,
              } as React.CSSProperties}
              role="listitem"
              aria-label={c.name}
              tabIndex={0}
              onMouseEnter={() => setActive(c.name)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(c.name)}
              onBlur={() => setActive(null)}
            >
              <div className="heatmap-cell-inner" aria-hidden="true" />
            </div>
          );
        })}
      </div>

      {/* Name reveal — shows below grid */}
      <div className="heatmap-reveal" aria-live="polite" aria-atomic="true">
        {active ? (
          <>
            <span className="heatmap-reveal-name">{active}</span>
            <span className="heatmap-reveal-status">
              {COLLABORATORS.find(c => c.name === active)?.current
                ? "active"
                : "past"}
            </span>
          </>
        ) : (
          <span className="heatmap-reveal-hint">hover to explore</span>
        )}
      </div>
    </section>
  );
}
