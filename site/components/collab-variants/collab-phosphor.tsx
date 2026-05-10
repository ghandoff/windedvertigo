"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { COLLABORATORS } from "@/lib/collaborators";

/**
 * #26 — Phosphorescent Bloom
 *
 * Names are scattered across a full-height section at 8% opacity —
 * almost invisible by default. Tap/click anywhere and a slow radial
 * bloom spreads outward, illuminating any names it reaches. Names
 * hold at full opacity for 2.5s then fade back.
 *
 * WCAG notes:
 * - Animation is 100% user-initiated → exempt from 2.2.2 pause rule
 * - Dim names are aria-hidden; a sr-only list provides screen-reader access
 * - prefers-reduced-motion: bloom skipped, names jump immediately to full opacity
 * - A visible "tap to reveal" hint prevents discovery-gap exclusion
 */

// Seeded positions spread across a ~80vh field (percentage of container)
const POSITIONS = [
  { left:  7, top:  6 }, { left: 45, top:  4 }, { left: 75, top: 10 },
  { left: 20, top: 20 }, { left: 58, top: 17 }, { left: 87, top: 26 },
  { left:  4, top: 36 }, { left: 36, top: 33 }, { left: 68, top: 38 },
  { left: 15, top: 52 }, { left: 50, top: 49 }, { left: 80, top: 55 },
  { left: 25, top: 66 }, { left: 62, top: 63 }, { left: 42, top: 77 },
  { left:  9, top: 80 }, { left: 72, top: 80 }, { left: 48, top: 90 },
];

const BLOOM_RADIUS_PCT = 28; // % of container width
const LIT_DURATION_MS  = 2500;

interface BloomEvent { id: number; x: number; y: number; }

let bloomIdCounter = 0;

export function CollabPhosphor() {
  const containerRef   = useRef<HTMLDivElement>(null);
  const [litSet, setLitSet]     = useState<Set<number>>(new Set());
  const [blooms, setBlooms]     = useState<BloomEvent[]>([]);
  const [hinted, setHinted]     = useState(false);
  const [reducedMotion, setRM]  = useState(false);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRM(mq.matches);
    const h = (e: MediaQueryListEvent) => setRM(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const triggerBloom = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    setHinted(true);

    const rect = container.getBoundingClientRect();
    const pctX = ((clientX - rect.left) / rect.width)  * 100;
    const pctY = ((clientY - rect.top)  / rect.height) * 100;

    // Find names within bloom radius
    const toLight: number[] = [];
    POSITIONS.forEach((pos, i) => {
      const dx = pos.left - pctX;
      // Correct for aspect ratio: container is wider than tall
      const aspectCorrect = rect.height / rect.width;
      const dy = (pos.top - pctY) * aspectCorrect;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BLOOM_RADIUS_PCT) toLight.push(i);
    });

    if (toLight.length === 0) {
      // If nothing nearby, light everything (generous fallback)
      POSITIONS.forEach((_, i) => toLight.push(i));
    }

    setLitSet(prev => {
      const next = new Set(prev);
      toLight.forEach(i => next.add(i));
      return next;
    });

    // Schedule fade-out for each lit name
    toLight.forEach(i => {
      if (timersRef.current.has(i)) clearTimeout(timersRef.current.get(i)!);
      timersRef.current.set(i, setTimeout(() => {
        setLitSet(prev => {
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
      }, LIT_DURATION_MS));
    });

    // Add bloom visual
    if (!reducedMotion) {
      const id = ++bloomIdCounter;
      setBlooms(b => [...b, { id, x: clientX - rect.left, y: clientY - rect.top }]);
      setTimeout(() => setBlooms(b => b.filter(bloom => bloom.id !== id)), 1800);
    }
  }, [reducedMotion]);

  return (
    <section
      className="collab-variant collab-phosphor"
      aria-label="organisations we play with"
      onClick={e  => triggerBloom(e.clientX, e.clientY)}
      onTouchStart={e => {
        e.preventDefault();
        triggerBloom(e.touches[0].clientX, e.touches[0].clientY);
      }}
    >
      <p className="collab-variant-label">organisations we play with</p>

      {/* Hint — fades once user has interacted */}
      <p
        className={`phosphor-hint${hinted ? " phosphor-hint--hidden" : ""}`}
        aria-hidden="true"
      >
        tap to illuminate
      </p>

      {/* Scatter field */}
      <div className="phosphor-field" ref={containerRef} aria-hidden="true">
        {COLLABORATORS.map((c, i) => {
          const pos = POSITIONS[i];
          const isLit = litSet.has(i);
          return (
            <span
              key={c.name}
              className={`phosphor-name${c.current ? " phosphor-name--current" : ""}${isLit ? " phosphor-name--lit" : ""}`}
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            >
              {c.name}
            </span>
          );
        })}

        {/* Bloom rings */}
        {blooms.map(b => (
          <span
            key={b.id}
            className="phosphor-bloom-ring"
            style={{ left: b.x, top: b.y }}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Screen reader accessible list */}
      <ul className="visually-hidden">
        {COLLABORATORS.map(c => (
          <li key={c.name}>{c.name}{c.current ? " (active)" : ""}</li>
        ))}
      </ul>
    </section>
  );
}
