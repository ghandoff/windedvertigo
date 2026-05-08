import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #19 — Torn Paper Collage
 *
 * Organisation names printed on scraps of "torn" paper — irregular polygon
 * clip-paths, slight rotations, varied sizes — scattered across a contained
 * frame. Looks like a research wall or a letter being assembled.
 *
 * Current partners: brighter scrap (champagne text, more opaque background).
 * Past partners: dimmer, slightly more rotated, as if pinned longer ago.
 *
 * No animation — quiet, textural, human-made feeling.
 * Mobile: scraps stack in a tighter field, still readable.
 * UDL: fully static, no motion. High contrast text on scrap backgrounds.
 */

// Torn polygon shapes — each is a CSS clip-path polygon string
// Varied irregular quadrilaterals to mimic torn paper edges
const TORN_SHAPES = [
  "polygon(0% 4%, 97% 0%, 100% 93%, 3% 100%)",
  "polygon(2% 0%, 100% 3%, 98% 100%, 0% 96%)",
  "polygon(0% 0%, 98% 2%, 100% 98%, 1% 100%)",
  "polygon(3% 2%, 100% 0%, 97% 100%, 0% 98%)",
  "polygon(0% 3%, 96% 0%, 100% 97%, 4% 100%)",
  "polygon(1% 0%, 99% 3%, 100% 100%, 0% 97%)",
  "polygon(0% 0%, 100% 2%, 98% 99%, 2% 100%)",
];

// Static placement grid — positions in percent of container for responsiveness
// Arranged so they overlap slightly, like scraps on a board
const POSITIONS = [
  { top:  4, left:  2, rot: -2 },
  { top:  2, left: 30, rot:  1.5 },
  { top:  3, left: 58, rot: -1 },
  { top: 32, left:  8, rot:  2 },
  { top: 30, left: 36, rot: -1.5 },
  { top: 31, left: 64, rot:  1 },
  { top: 58, left:  4, rot: -2.5 },
  { top: 57, left: 32, rot:  2 },
  { top: 59, left: 62, rot: -1 },
  // Row 4 (overflows to scroll naturally on small screens)
  { top: 86, left:  6, rot:  1.5 },
  { top: 85, left: 34, rot: -1 },
  { top: 87, left: 60, rot:  2 },
  // Row 5 — remaining 6
  { top: 114, left:  2, rot: -1.5 },
  { top: 112, left: 30, rot:  2 },
  { top: 115, left: 58, rot: -2 },
  { top: 142, left:  8, rot:  1 },
  { top: 140, left: 36, rot: -1.5 },
  { top: 141, left: 64, rot:  2 },
];

export function CollabTornPaper() {
  return (
    <section className="collab-variant collab-torn" aria-label="organisations we play with">
      <p className="collab-variant-label">organisations we play with</p>
      <div className="torn-field" aria-hidden="false">
        {COLLABORATORS.map((c, i) => {
          const pos = POSITIONS[i % POSITIONS.length];
          const shape = TORN_SHAPES[i % TORN_SHAPES.length];
          return (
            <div
              key={c.name}
              className={`torn-scrap${c.current ? " torn-scrap--current" : ""}`}
              style={{
                top: `${pos.top}%`,
                left: `${pos.left}%`,
                transform: `rotate(${pos.rot}deg)`,
                clipPath: shape,
              }}
              aria-label={c.name}
            >
              <span className="torn-scrap-name">{c.name}</span>
              {c.current && <span className="torn-scrap-dot" aria-label="active" />}
            </div>
          );
        })}
      </div>
      {/* Accessible list */}
      <ul className="visually-hidden">
        {COLLABORATORS.map((c) => (
          <li key={c.name}>{c.name}{c.current ? " (active)" : ""}</li>
        ))}
      </ul>
    </section>
  );
}
