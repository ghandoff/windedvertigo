/**
 * @windedvertigo/motion-kit — motion tokens
 *
 * The JS/TS constants mirror index.css exactly.
 * Use these when CSS custom properties aren't available
 * (server rendering, email, Node.js animation, tests).
 */

/* ── duration (ms) ──────────────────────────────────────────────── */

export const duration = {
  instant:   0,
  fast:      120,
  base:      240,
  slow:      400,
  cinematic: 700,
} as const;

/* ── easing ─────────────────────────────────────────────────────── */

export const easing = {
  /** Standard enter — quick ease-out; objects decelerate into place. */
  enter:        [0.0, 0.0, 0.2, 1.0] as [number, number, number, number],
  /** Standard exit — ease-in; objects accelerate away. */
  exit:         [0.4, 0.0, 1.0, 1.0] as [number, number, number, number],
  /** Crisp back-and-forth for emphasis (no overshoot). */
  sharp:        [0.4, 0.0, 0.6, 1.0] as [number, number, number, number],
  /** Gentle spring — use for popups, card reveals, playful bounces. */
  springBouncy: "spring(1, 80, 10, 0)" as const,
  /** Snappy spring — use for fast UI responses (toggles, chips). */
  springSnappy: "spring(1, 200, 20, 0)" as const,
} as const;

/* ── distance (px) — how far elements travel on enter/exit ─────── */

export const distance = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  32,
  xl:  64,
} as const;

/* ── stagger (ms between children) ─────────────────────────────── */

export const stagger = {
  tight:  30,
  base:   60,
  loose:  100,
} as const;
