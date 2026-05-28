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
 *
 * Custom artwork: when Payton delivers a boat SVG, add `svgHref` (single
 * image) or `svgPair` ([left, right] side-by-side pair) to the entry.
 * The renderer swaps the placeholder ellipse for <image> automatically.
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
  /**
   * Optional custom artwork from Payton.
   *
   * svgHref   — single SVG image, centred on cx/cy.
   * svgPair   — [left, right] two SVGs displayed side-by-side, centred on cx/cy.
   *             Both files in a pair must share the same viewBox aspect ratio.
   * svgHeight — render height in viewBox units (width computed from aspect ratio).
   *             Defaults to ry * 2 when omitted.
   * svgAspect — width / height of the SVG viewBox (default: 1).
   */
  svgHref?:   string;
  svgPair?:   readonly [string, string];
  svgHeight?: number;
  svgAspect?: number;
  /**
   * Per-game modal identity (the card that opens when a boat is tapped).
   * badge      — badge SVG from /harbour-preview/ rendered at badgeSize × badgeSize px.
   * badgeSize  — icon render size in px (default: 52). Override to visually harmonise
   *              icons whose content fills a different proportion of the viewBox.
   * modalName  — canonical period-separated name shown in the modal title.
   * accent     — "open app →" button background (the game's primary brand colour).
   * accentText — button label colour, chosen for contrast against `accent`.
   */
  badge?:      string;
  badgeSize?:  number;
  modalName?:  string;
  accent?:     string;
  accentText?: string;
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
  // Per-app boat SVGs from Payton — all portrait (taller than wide).
  // svgHeight: 240 → 60px display at BOAT_SCALE 0.25.
  // svgAspect is width / height of each SVG's viewBox.
  {
    slug: "vertigo-vault",
    label: "vertigo.vault",
    href: "/harbour/vertigo-vault",
    tagline: "wake up your group, with a library of activities, ice-breakers, and energisers.",
    cx: 250,
    cy: 150,
    rx: 130,
    ry: 60,
    status: "live",
    svgHref:   "/harbour-preview/vertigo-vault.svg",
    svgHeight: 360,
    svgAspect: 255.79 / 368.4,
    badge:      "/harbour-preview/vertigo-vault.svg",
    badgeSize:  44,
    modalName:  "vertigo.vault",
    accent:     "#cb7858",
    accentText: "#ffebd2",
  },
  {
    slug: "lines-become-loops",
    label: "lines become loops",
    href: "/harbour/lines-become-loops",
    tagline: "a systems-thinking simulator that turns linear thinking into loops.",
    cx: 650,
    cy: 260,
    rx: 150,
    ry: 65,
    status: "live",
    svgHref:   "/harbour-preview/lines-become-loops.svg",
    svgHeight: 360,
    svgAspect: 289.13 / 367.66,
    badge:      "/harbour-preview/lines-become-loops.svg",
    modalName:  "lines.become.loops",
    accent:     "#58cbb2",
    accentText: "#273248",
  },
  {
    slug: "regenerative-practices-catalogue",
    label: "regenerative.practices.catalogue",
    href: "/harbour/regenerative-practices-catalogue",
    tagline: "a living catalogue of regenerative teaching practices.",
    cx: 440,
    cy: 300,
    rx: 130,
    ry: 60,
    status: "live",
    svgHref:   "/harbour-preview/regenerative-library.svg",
    svgHeight: 360,
    svgAspect: 289.13 / 367.66,
    badge:      "/harbour-preview/regenerative-library.svg",
    modalName:  "regenerative.practices",
    accent:     "#434824",
    accentText: "#ffebd2",
  },
  {
    slug: "depth-chart",
    label: "depth.chart",
    href: "/harbour/depth-chart",
    tagline: "AI-assisted assessment generator for PRME faculty. coming soon.",
    cx: 430,
    cy: 683,
    rx: 130,
    ry: 60,
    status: "coming-soon",
    svgHref:   "/harbour-preview/depth-chart.svg",
    svgHeight: 360,
    svgAspect: 245.79 / 377.97,
  },
  {
    slug: "read-the-room",
    label: "read the room",
    href: "/harbour/read-the-room",
    tagline: "a quiet game of interpretation.",
    cx: 490,
    cy: 440,
    rx: 130,
    ry: 60,
    status: "live",
    svgHref:   "/harbour-preview/read-the-room.svg",
    svgHeight: 360,
    svgAspect: 289.32 / 367.87,
    badge:      "/harbour-preview/read-the-room.svg",
    modalName:  "read.the.room",
    accent:     "#436db1",
    accentText: "#ffebd2",
  },
  {
    slug: "values-companion",
    label: "values.companion",
    href: "/harbour/values-companion",
    tagline: "a live, facilitator-driven values game. play for what matters.",
    cx: 780,
    cy: 390,
    rx: 145,
    ry: 60,
    status: "live",
    svgHref:   "/harbour-preview/values-auction.svg",
    svgHeight: 360,
    svgAspect: 317.47 / 372.09,
    badge:      "/harbour-preview/values-auction.svg",
    modalName:  "values.companion",
    accent:     "#b15043",
    accentText: "#ffebd2",
  },
  {
    slug: "cuts-catalogue",
    label: "cuts.catalogue",
    href: "/harbour/cuts-catalogue",
    tagline: "a catalogue of editorial cuts, an interactive narrative pacing tool.",
    cx: 260,
    cy: 520,
    rx: 135,
    ry: 60,
    status: "live",
    svgHref:   "/harbour-preview/cuts-catalogue.svg",
    svgHeight: 360,
    svgAspect: 289.13 / 367.66,
    badge:      "/harbour-preview/cuts-catalogue.svg",
    modalName:  "cuts.catalogue",
    accent:     "#cb7858",
    accentText: "#ffebd2",
  },
  {
    slug: "co-rubric-companion",
    label: "co.rubric",
    href: "/harbour/co-rubric-companion",
    tagline: "co-design an assessment rubric with your class in real time.",
    cx: 710,
    cy: 520,
    rx: 125,
    ry: 60,
    status: "live",
    svgHref:   "/harbour-preview/co-rubric.svg",
    svgHeight: 360,
    svgAspect: 289.13 / 367.66,
    badge:      "/harbour-preview/co-rubric.svg",
    modalName:  "co.rubric",
    accent:     "#482d27",
    accentText: "#ffebd2",
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
    svgHref:   "/harbour-preview/crease-works.svg",
    svgHeight: 360,
    svgAspect: 254.57 / 368.4,
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
