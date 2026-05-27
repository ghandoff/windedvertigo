/**
 * harbour-preview — single source of truth for boat + landmark positions
 * inside the SVG.
 *
 * Coordinate system: the SVG renders with viewBox="0 0 1000 1300" — matching
 * the fixed 1300px container height. All cx/cy values below are in those
 * viewBox units, so a (500, 650) boat sits dead-centre.
 *
 * Why these are placeholders: Payton is producing per-app boat SVGs and
 * Fruit is producing the background harbour. When the real art arrives,
 * we keep `cx` / `cy` and swap the placeholder ellipses for `<image>`
 * elements anchored at the same coords. The data file doesn't change.
 *
 * Boat positions roughly mirror the mockup screenshot from the design
 * session — they're not authoritative; expect Maria/Payton to nudge them
 * during review.
 */

export type BoatStatus = "live" | "coming-soon";

export interface Boat {
  /** url path segment under /harbour/ */
  slug: string;
  /** display text rendered on / near the boat */
  label: string;
  /** navigation target — full path, used as the SVG <a> href */
  href: string;
  /** one-sentence reminder for the hover/tap tooltip */
  tagline: string;
  /** centre x in the 1000-wide viewBox */
  cx: number;
  /** centre y in the 1300-tall viewBox */
  cy: number;
  /** ellipse radius x (placeholder shape) */
  rx: number;
  /** ellipse radius y (placeholder shape) */
  ry: number;
  /**
   * live = clickable + bobs + accent fill.
   * coming-soon = inert click target, dashed stroke, muted fill, tooltip
   * says "coming soon".
   */
  status: BoatStatus;
}

export interface Landmark {
  id: string;
  label: string;
  cx: number;
  cy: number;
  shape: "circle" | "rect";
  /** for circle: radius. for rect: half-width (rendered width = 2× size). */
  size: number;
  /**
   * scaffold for future interactivity. undefined = inert (current state).
   * Define this later when we decide e.g. lighthouse → /harbour/start.
   */
  href?: string;
  /** rect-only: explicit height (rect is rendered as 2*size × heightOverride or 2*size by default). */
  heightOverride?: number;
}

export interface Pier {
  id: string;
  label: string;
  /** top-left x of the rect (in viewBox units) */
  x: number;
  /** top-left y of the rect */
  y: number;
  width: number;
  height: number;
}

/**
 * 8 boats. Six wave-1 freemium (live) and two coming-soon.
 * Positions cluster in the middle of the harbour basin (the central water
 * column) so they feel like a fleet, not a scattered grid.
 */
export const BOATS: readonly Boat[] = [
  {
    slug: "vertigo-vault",
    label: "vertigo.vault",
    href: "/harbour/vertigo-vault",
    tagline: "a curated catalogue of group activities, energizers, and reflective exercises.",
    cx: 290,
    cy: 566,
    rx: 130,
    ry: 60,
    status: "live",
  },
  {
    slug: "lines-become-loops",
    label: "lines become loops",
    href: "/harbour/lines-become-loops",
    tagline: "a systems-thinking simulator — small choices ripple into the whole system.",
    cx: 500,
    cy: 644,
    rx: 150,
    ry: 65,
    status: "live",
  },
  {
    slug: "depth-chart",
    label: "depth.chart",
    href: "/harbour/depth-chart",
    tagline: "AI-assisted assessment generator for PRME faculty. coming soon.",
    cx: 200,
    cy: 683,
    rx: 130,
    ry: 60,
    status: "coming-soon",
  },
  {
    slug: "read-the-room",
    label: "read the room",
    href: "/harbour/read-the-room",
    tagline: "a quiet two-player game of interpretation.",
    cx: 520,
    cy: 735,
    rx: 130,
    ry: 60,
    status: "live",
  },
  {
    slug: "values-companion",
    label: "values.companion",
    href: "/harbour/values-companion",
    tagline: "a values game for facilitators — free for the PRME community.",
    cx: 720,
    cy: 715,
    rx: 145,
    ry: 60,
    status: "live",
  },
  {
    slug: "cuts-catalogue",
    label: "cuts.catalogue",
    href: "/harbour/cuts-catalogue",
    tagline: "a vocabulary of narrative pacing cuts — for writers, editors, and educators.",
    cx: 360,
    cy: 780,
    rx: 135,
    ry: 60,
    status: "live",
  },
  {
    slug: "co-rubric-companion",
    label: "co.rubric",
    href: "/harbour/co-rubric-companion",
    tagline: "co-design assessment with your class — free for the PRME community.",
    cx: 580,
    cy: 839,
    rx: 125,
    ry: 60,
    status: "live",
  },
  {
    slug: "creaseworks",
    label: "crease.works",
    href: "/harbour/creaseworks",
    tagline: "the kid + family system of play. coming soon.",
    cx: 470,
    cy: 962,
    rx: 130,
    ry: 60,
    status: "coming-soon",
  },
];

/**
 * Four piers. Brown rects with text labels — the IA categories made
 * legible. Positions match the mockup: leadership top-left, classroom
 * middle-right, family-play bottom-left, threshold bottom-centre.
 */
export const PIERS: readonly Pier[] = [
  {
    id: "leadership",
    label: "leadership",
    x: 110,
    y: 700,
    width: 220,
    height: 60,
  },
  {
    id: "classroom",
    label: "classroom",
    x: 640,
    y: 1230,
    width: 220,
    height: 60,
  },
  {
    id: "family-play",
    label: "family play",
    x: 200,
    y: 1480,
    width: 200,
    height: 60,
  },
  {
    id: "threshold",
    label: "threshold",
    x: 470,
    y: 1700,
    width: 130,
    height: 130,
  },
];

/**
 * Landmarks. Decorative right now — `href` undefined on all of them.
 * When we decide e.g. lighthouse → /harbour/start, set href and the SVG
 * starts treating it as an <a>. No layout change needed.
 */
export const LANDMARKS: readonly Landmark[] = [
  {
    id: "light-house",
    label: "light house",
    cx: 880,
    cy: 540,
    shape: "circle",
    size: 80,
  },
  {
    id: "ferris-wheel",
    label: "ferris wheel",
    cx: 90,
    cy: 1850,
    shape: "circle",
    size: 95,
  },
  {
    id: "aquarium",
    label: "aquarium",
    cx: 870,
    cy: 1880,
    shape: "rect",
    size: 80,
    heightOverride: 130,
  },
];
