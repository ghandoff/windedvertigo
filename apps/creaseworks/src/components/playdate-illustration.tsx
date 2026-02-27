"use client";

/**
 * Deterministic SVG illustration generator for playdate cards.
 * Uses the playdate slug and primaryFunction to generate unique abstract patterns.
 */

interface PlaydateIllustrationProps {
  slug: string;
  primaryFunction: string | null;
  /** optional: override the default height (default: 120px) */
  height?: number;
  /** optional: context tags from the playdate â used to scatter activity-hint motifs */
  contextTags?: string[];
}

/**
 * Simple hash function to seed pseudo-random generation.
 * Ensures same slug always produces same pattern.
 */
function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    const char = slug.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Seeded pseudo-random number generator.
 * Returns a number between 0 and 1.
 */
function seededRandom(seed: number, index: number): number {
  const x = Math.sin((seed + index) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Design token colors */
const COLORS = {
  champagne: "#ffebd2",
  sienna: "#cb7858",
  redwood: "#b15043",
  cadet: "#273248",
  sage: "#9ca89c", // default safe color
};

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
}

/**
 * Get a color palette for the illustration.
 * Derives from primaryFunction or generates random palette from seed.
 */
function getColorPalette(
  primaryFunction: string | null,
  seed: number,
): ColorPalette {
  const functionLower = primaryFunction?.toLowerCase() ?? "";

  // Map functions to color combinations
  if (functionLower.includes("observe")) {
    return {
      primary: COLORS.cadet,
      secondary: COLORS.champagne,
      accent: COLORS.sienna,
    };
  }
  if (functionLower.includes("construct")) {
    return {
      primary: COLORS.redwood,
      secondary: COLORS.champagne,
      accent: COLORS.sienna,
    };
  }
  if (functionLower.includes("explore")) {
    return {
      primary: COLORS.sienna,
      secondary: COLORS.champagne,
      accent: COLORS.cadet,
    };
  }
  if (functionLower.includes("transform")) {
    return {
      primary: COLORS.redwood,
      secondary: COLORS.sienna,
      accent: COLORS.champagne,
    };
  }
  if (functionLower.includes("connect")) {
    return {
      primary: COLORS.cadet,
      secondary: COLORS.sienna,
      accent: COLORS.champagne,
    };
  }
  if (functionLower.includes("experiment")) {
    return {
      primary: COLORS.champagne,
      secondary: COLORS.sienna,
      accent: COLORS.redwood,
    };
  }

  // Default: random palette from seed
  const colors = Object.values(COLORS);
  const r1 = Math.floor(seededRandom(seed, 0) * colors.length);
  const r2 = Math.floor(seededRandom(seed, 1) * colors.length);
  const r3 = Math.floor(seededRandom(seed, 2) * colors.length);
  return {
    primary: colors[r1],
    secondary: colors[r2],
    accent: colors[r3],
  };
}

/**
 * Generate SVG for "observe" pattern (circles and dots).
 */
function renderObservePattern(
  palette: ColorPalette,
  seed: number,
  width: number,
  height: number,
): string {
  let svg = "";
  const dotCount = 5 + Math.floor(seededRandom(seed, 10) * 4);

  // Draw circles with varying opacity
  for (let i = 0; i < dotCount; i++) {
    const x = seededRandom(seed, 20 + i) * width;
    const y = seededRandom(seed, 30 + i) * height;
    const r = 4 + seededRandom(seed, 40 + i) * 8;
    const opacity = 0.3 + seededRandom(seed, 50 + i) * 0.5;
    const color =
      i % 3 === 0 ? palette.primary : i % 3 === 1 ? palette.secondary : palette.accent;

    svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`;
  }

  // Add subtle grid lines
  for (let i = 0; i < 3; i++) {
    const x = (width / 3) * (i + 1);
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${palette.primary}" stroke-width="0.5" opacity="0.1" />`;
  }

  return svg;
}

/**
 * Generate SVG for "construct" pattern (geometric blocks).
 */
function renderConstructPattern(
  palette: ColorPalette,
  seed: number,
  width: number,
  height: number,
): string {
  let svg = "";
  const blockCount = 4 + Math.floor(seededRandom(seed, 10) * 3);
  const blockSize = Math.min(width, height) / 3;

  for (let i = 0; i < blockCount; i++) {
    const x = seededRandom(seed, 20 + i) * (width - blockSize);
    const y = seededRandom(seed, 30 + i) * (height - blockSize);
    const size = blockSize * (0.6 + seededRandom(seed, 40 + i) * 0.4);
    const rotation = seededRandom(seed, 50 + i) * 45;
    const color =
      i % 2 === 0 ? palette.primary : palette.secondary;

    svg += `<g transform="translate(${x + size / 2},${y + size / 2}) rotate(${rotation})">
      <rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" fill="${color}" opacity="0.4" />
    </g>`;
  }

  return svg;
}

/**
 * Generate SVG for "explore" pattern (wavy lines).
 */
function renderExplorePattern(
  palette: ColorPalette,
  seed: number,
  width: number,
  height: number,
): string {
  let svg = "";
  const waveCount = 3 + Math.floor(seededRandom(seed, 10) * 2);
  const amplitude = height / 8;
  const frequency = 0.02;

  for (let w = 0; w < waveCount; w++) {
    let pathD = `M 0 ${height / 2 + w * (height / waveCount) - height / 4}`;

    for (let x = 0; x <= width; x += 10) {
      const y =
        height / 2 +
        w * (height / waveCount) -
        height / 4 +
        amplitude * Math.sin(x * frequency + w);
      pathD += ` L ${x} ${y}`;
    }

    const color =
      w % 2 === 0 ? palette.primary : palette.secondary;
    svg += `<path d="${pathD}" stroke="${color}" stroke-width="2" fill="none" opacity="0.5" />`;
  }

  return svg;
}

/**
 * Generate SVG for "transform" pattern (spiral/swirl).
 */
function renderTransformPattern(
  palette: ColorPalette,
  seed: number,
  width: number,
  height: number,
): string {
  let svg = "";
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2.5;

  // Draw concentric spirals
  for (let r = 0; r < maxRadius; r += 8) {
    const color =
      r % 16 < 8 ? palette.primary : palette.secondary;
    const opacity = 0.3 + (r / maxRadius) * 0.4;

    svg += `<circle cx="${centerX}" cy="${centerY}" r="${r}" stroke="${color}" stroke-width="1.5" fill="none" opacity="${opacity}" />`;
  }

  // Add radial lines for swirl effect
  for (let angle = 0; angle < 360; angle += 45) {
    const rad = (angle * Math.PI) / 180;
    const x1 = centerX + Math.cos(rad) * (maxRadius / 3);
    const y1 = centerY + Math.sin(rad) * (maxRadius / 3);
    const x2 = centerX + Math.cos(rad) * maxRadius;
    const y2 = centerY + Math.sin(rad) * maxRadius;

    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${palette.accent}" stroke-width="1" opacity="0.3" />`;
  }

  return svg;
}

/**
 * Generate SVG for "connect" pattern (interconnected dots).
 */
function renderConnectPattern(
  palette: ColorPalette,
  seed: number,
  width: number,
  height: number,
): string {
  let svg = "";
  const nodeCount = 5 + Math.floor(seededRandom(seed, 10) * 3);
  const nodes: Array<{ x: number; y: number }> = [];

  // Place nodes
  for (let i = 0; i < nodeCount; i++) {
    const x = seededRandom(seed, 20 + i) * width;
    const y = seededRandom(seed, 30 + i) * height;
    nodes.push({ x, y });
  }

  // Draw connecting lines
  for (let i = 0; i < nodes.length; i++) {
    const connectionCount = 2 + Math.floor(seededRandom(seed, 40 + i) * 2);
    for (let c = 0; c < connectionCount; c++) {
      const j = (i + 1 + Math.floor(seededRandom(seed, 50 + i + c) * 2)) % nodes.length;
      svg += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="${palette.secondary}" stroke-width="1" opacity="0.3" />`;
    }
  }

  // Draw nodes
  for (const node of nodes) {
    svg += `<circle cx="${node.x}" cy="${node.y}" r="3" fill="${palette.primary}" opacity="0.7" />`;
  }

  return svg;
}

/**
 * Generate SVG for "experiment" pattern (bubbles/splash).
 */
function renderExperimentPattern(
  palette: ColorPalette,
  seed: number,
  width: number,
  height: number,
): string {
  let svg = "";
  const bubbleCount = 8 + Math.floor(seededRandom(seed, 10) * 6);
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < bubbleCount; i++) {
    const angle = (i / bubbleCount) * 360;
    const rad = (angle * Math.PI) / 180;
    const distance = 20 + seededRandom(seed, 20 + i) * (Math.min(width, height) / 3);
    const x = centerX + Math.cos(rad) * distance;
    const y = centerY + Math.sin(rad) * distance;
    const r = 4 + seededRandom(seed, 30 + i) * 6;
    const color =
      i % 3 === 0 ? palette.primary : i % 3 === 1 ? palette.secondary : palette.accent;

    svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${0.4 + seededRandom(seed, 40 + i) * 0.4}" />`;
  }

  // Central splash marker
  svg += `<circle cx="${centerX}" cy="${centerY}" r="2" fill="${palette.accent}" opacity="0.6" />`;

  return svg;
}

/**
 * Generate SVG for default pattern (simple gradient shape).
 */
function renderDefaultPattern(
  palette: ColorPalette,
  seed: number,
  width: number,
  height: number,
): string {
  let svg = "";
  const shapeCount = 3 + Math.floor(seededRandom(seed, 10) * 2);

  // Add gradient definition
  const gradientId = `grad-${Math.random().toString(36).substr(2, 9)}`;
  svg += `<defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${palette.primary};stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:${palette.secondary};stop-opacity:0.5" />
    </linearGradient>
  </defs>`;

  // Draw organic shapes
  for (let i = 0; i < shapeCount; i++) {
    const x = seededRandom(seed, 20 + i) * width;
    const y = seededRandom(seed, 30 + i) * height;
    const radius = 15 + seededRandom(seed, 40 + i) * 25;

    svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="url(#${gradientId})" />`;
  }

  return svg;
}

/**
 * Main render function that dispatches to pattern generators.
 */
function renderPattern(
  primaryFunction: string | null,
  seed: number,
  width: number,
  height: number,
): string {
  const palette = getColorPalette(primaryFunction, seed);
  const functionLower = primaryFunction?.toLowerCase() ?? "";

  if (functionLower.includes("observe")) {
    return renderObservePattern(palette, seed, width, height);
  }
  if (functionLower.includes("construct")) {
    return renderConstructPattern(palette, seed, width, height);
  }
  if (functionLower.includes("explore")) {
    return renderExplorePattern(palette, seed, width, height);
  }
  if (functionLower.includes("transform")) {
    return renderTransformPattern(palette, seed, width, height);
  }
  if (functionLower.includes("connect")) {
    return renderConnectPattern(palette, seed, width, height);
  }
  if (functionLower.includes("experiment")) {
    return renderExperimentPattern(palette, seed, width, height);
  }

  return renderDefaultPattern(palette, seed, width, height);
}

/* ââ activity-hint motifs ââ
 * Small iconic shapes scattered over the illustration to hint at the
 * activity's physicality. Each keyword maps to a tiny SVG snippet
 * rendered at a deterministic position derived from the slug hash.
 */

const HINT_MOTIFS: Record<string, string> = {
  // physical actions
  cut:       `<path d="M-3-2L0 2L3-2M-3 2L0-2L3 2" stroke="${COLORS.redwood}" stroke-width="0.8" fill="none" opacity="0.35"/>`,
  tear:      `<path d="M-3 0Q0-3 3 0" stroke="${COLORS.sienna}" stroke-width="0.7" fill="none" opacity="0.3" stroke-dasharray="1 0.8"/>`,
  fold:      `<path d="M-3-1L0 1L3-1" stroke="${COLORS.cadet}" stroke-width="0.7" fill="none" opacity="0.3"/>`,
  stack:     `<rect x="-2.5" y="-1" width="5" height="2" rx="0.3" fill="${COLORS.cadet}" opacity="0.15"/><rect x="-2" y="-2.5" width="4" height="2" rx="0.3" fill="${COLORS.sienna}" opacity="0.2"/>`,
  wrap:      `<circle cx="0" cy="0" r="2.5" stroke="${COLORS.sienna}" stroke-width="0.6" fill="none" opacity="0.25" stroke-dasharray="1.5 1"/>`,
  pour:      `<path d="M-1-3Q0 0 2 3" stroke="${COLORS.sienna}" stroke-width="0.8" fill="none" opacity="0.3" stroke-linecap="round"/>`,
  squeeze:   `<ellipse cx="0" cy="0" rx="2" ry="3" fill="${COLORS.redwood}" opacity="0.12"/>`,
  roll:      `<circle cx="0" cy="0" r="2" fill="none" stroke="${COLORS.sienna}" stroke-width="0.6" opacity="0.25"/>`,
  paint:     `<path d="M-2 2L0-3L2 2" fill="${COLORS.redwood}" opacity="0.15"/><line x1="0" y1="-3" x2="0" y2="3" stroke="${COLORS.sienna}" stroke-width="0.5" opacity="0.25"/>`,
  draw:      `<path d="M-3 2Q0-2 3 1" stroke="${COLORS.cadet}" stroke-width="0.7" fill="none" opacity="0.3" stroke-linecap="round"/>`,
  stamp:     `<rect x="-2" y="-2" width="4" height="4" rx="0.5" fill="${COLORS.redwood}" opacity="0.12"/>`,
  weave:     `<path d="M-3 0Q-1.5-2 0 0Q1.5 2 3 0" stroke="${COLORS.sienna}" stroke-width="0.6" fill="none" opacity="0.3"/>`,
  // material hints
  water:     `<path d="M-2 0Q0-3 2 0Q0 3-2 0Z" fill="${COLORS.cadet}" opacity="0.12"/>`,
  paper:     `<rect x="-2.5" y="-2" width="5" height="4" rx="0.3" fill="${COLORS.champagne}" stroke="${COLORS.sienna}" stroke-width="0.4" opacity="0.3"/>`,
  clay:      `<ellipse cx="0" cy="0" rx="3" ry="2" fill="${COLORS.sienna}" opacity="0.15"/>`,
  sand:      `<circle cx="-1" cy="1" r="0.6" fill="${COLORS.sienna}" opacity="0.3"/><circle cx="1" cy="0" r="0.5" fill="${COLORS.sienna}" opacity="0.25"/><circle cx="0" cy="-1" r="0.4" fill="${COLORS.sienna}" opacity="0.2"/>`,
  fabric:    `<line x1="-3" y1="-1" x2="3" y2="-1" stroke="${COLORS.cadet}" stroke-width="0.3" opacity="0.2"/><line x1="-3" y1="1" x2="3" y2="1" stroke="${COLORS.cadet}" stroke-width="0.3" opacity="0.2"/>`,
  string:    `<path d="M-3 1Q0-2 3 1" stroke="${COLORS.sienna}" stroke-width="0.7" fill="none" opacity="0.3"/>`,
  glue:      `<ellipse cx="0" cy="0" rx="1.5" ry="2" fill="${COLORS.champagne}" opacity="0.35"/>`,
  tape:      `<rect x="-3" y="-0.8" width="6" height="1.6" rx="0.3" fill="${COLORS.champagne}" opacity="0.3" stroke="${COLORS.sienna}" stroke-width="0.3"/>`,
  bubble:    `<circle cx="0" cy="0" r="2.5" fill="none" stroke="${COLORS.cadet}" stroke-width="0.5" opacity="0.2"/>`,
  leaf:      `<path d="M0-3Q3 0 0 3Q-3 0 0-3Z" fill="${COLORS.sage}" opacity="0.2"/>`,
  stick:     `<line x1="-2" y1="3" x2="2" y2="-3" stroke="${COLORS.sienna}" stroke-width="0.8" opacity="0.25" stroke-linecap="round"/>`,
};

/**
 * Pick up to 5 hint motifs from the context tags and scatter them
 * at deterministic positions across the illustration.
 */
function renderActivityHints(
  contextTags: string[],
  seed: number,
  width: number,
  height: number,
): string {
  if (contextTags.length === 0) return "";

  const joined = contextTags.join(" ").toLowerCase();
  const matched: string[] = [];

  for (const [keyword, motif] of Object.entries(HINT_MOTIFS)) {
    if (joined.includes(keyword)) matched.push(motif);
    if (matched.length >= 5) break;
  }

  if (matched.length === 0) return "";

  let svg = "";
  for (let i = 0; i < matched.length; i++) {
    // deterministic placement: spread across the width, varied y
    const x = (width * (0.12 + seededRandom(seed, 100 + i) * 0.76));
    const y = (height * (0.15 + seededRandom(seed, 110 + i) * 0.6));
    const scale = 1.4 + seededRandom(seed, 120 + i) * 0.8;
    svg += `<g transform="translate(${x},${y}) scale(${scale})">${matched[i]}</g>`;
  }

  return svg;
}

/* ── central function icon ──
 * A larger symbolic shape placed at the centre of the illustration
 * to clearly communicate the type of activity at a glance.
 * Each function category maps to a recognisable icon.
 */
function renderFunctionIcon(
  primaryFunction: string | null,
  seed: number,
  width: number,
  height: number,
): string {
  if (!primaryFunction) return "";
  const fn = primaryFunction.toLowerCase();
  const cx = width / 2;
  const cy = height / 2;

  // observe → eye icon
  if (fn.includes("observe")) {
    return `
      <g transform="translate(${cx},${cy})" opacity="0.18">
        <ellipse rx="12" ry="8" fill="none" stroke="${COLORS.cadet}" stroke-width="1.5"/>
        <circle r="4" fill="${COLORS.cadet}"/>
        <circle r="1.5" fill="${COLORS.champagne}"/>
      </g>`;
  }
  // construct → stacked blocks
  if (fn.includes("construct")) {
    return `
      <g transform="translate(${cx - 8},${cy - 6})" opacity="0.16">
        <rect width="10" height="8" rx="1" fill="${COLORS.redwood}"/>
        <rect x="6" width="10" height="8" rx="1" fill="${COLORS.sienna}"/>
        <rect x="3" y="-7" width="10" height="8" rx="1" fill="${COLORS.champagne}" stroke="${COLORS.redwood}" stroke-width="0.5"/>
      </g>`;
  }
  // explore → compass/star
  if (fn.includes("explore")) {
    return `
      <g transform="translate(${cx},${cy})" opacity="0.16">
        <circle r="10" fill="none" stroke="${COLORS.sienna}" stroke-width="1"/>
        <path d="M0-8L2-2L8 0L2 2L0 8L-2 2L-8 0L-2-2Z" fill="${COLORS.sienna}" opacity="0.6"/>
        <circle r="1.5" fill="${COLORS.redwood}"/>
      </g>`;
  }
  // transform → spiral arrow
  if (fn.includes("transform")) {
    return `
      <g transform="translate(${cx},${cy})" opacity="0.16">
        <path d="M0-9A9 9 0 1 1-6.4 6.4" fill="none" stroke="${COLORS.redwood}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M-6.4 6.4L-3 4L-4 7.5Z" fill="${COLORS.redwood}"/>
      </g>`;
  }
  // connect → linked circles
  if (fn.includes("connect")) {
    return `
      <g transform="translate(${cx},${cy})" opacity="0.16">
        <line x1="-7" y1="0" x2="7" y2="0" stroke="${COLORS.cadet}" stroke-width="1.2"/>
        <line x1="0" y1="-7" x2="0" y2="7" stroke="${COLORS.cadet}" stroke-width="1.2"/>
        <circle cx="-7" cy="0" r="3.5" fill="${COLORS.cadet}" opacity="0.5"/>
        <circle cx="7" cy="0" r="3.5" fill="${COLORS.sienna}" opacity="0.5"/>
        <circle cx="0" cy="-7" r="3.5" fill="${COLORS.redwood}" opacity="0.5"/>
        <circle cx="0" cy="7" r="3.5" fill="${COLORS.champagne}" stroke="${COLORS.cadet}" stroke-width="0.5" opacity="0.6"/>
      </g>`;
  }
  // experiment → beaker/flask
  if (fn.includes("experiment")) {
    return `
      <g transform="translate(${cx},${cy})" opacity="0.16">
        <path d="M-3-10L-3-3L-9 8Q-9 10 0 10Q9 10 9 8L3-3L3-10Z" fill="none" stroke="${COLORS.sienna}" stroke-width="1.2"/>
        <path d="M-7 5Q0 2 7 5Q7 10 0 10Q-7 10-7 5Z" fill="${COLORS.redwood}" opacity="0.3"/>
        <circle cx="-2" cy="6" r="1.5" fill="${COLORS.redwood}" opacity="0.4"/>
        <circle cx="3" cy="4" r="1" fill="${COLORS.sienna}" opacity="0.4"/>
      </g>`;
  }
  // default → lightbulb shape
  const r = seededRandom(seed, 200);
  return `
    <g transform="translate(${cx},${cy})" opacity="0.14">
      <circle r="8" fill="none" stroke="${r > 0.5 ? COLORS.sienna : COLORS.cadet}" stroke-width="1"/>
      <circle r="3" fill="${r > 0.5 ? COLORS.sienna : COLORS.cadet}" opacity="0.4"/>
    </g>`;
}

/**
 * PlaydateIllustration component
 * Generates a deterministic abstract SVG pattern for a playdate card,
 * with optional activity-hint motifs derived from context tags.
 */
export function PlaydateIllustration({
  slug,
  primaryFunction,
  height = 120,
  contextTags = [],
}: PlaydateIllustrationProps) {
  const seed = hashSlug(slug);
  const width = 100; // as percentage, will fill container
  const svgPattern = renderPattern(primaryFunction, seed, width, height);
  const hints = renderActivityHints(contextTags, seed, width, height);
  const icon = renderFunctionIcon(primaryFunction, seed, width, height);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      style={{ height: `${height}px`, display: "block" }}
      aria-hidden="true"
    >
      {/* Subtle background */}
      <rect width={width} height={height} fill="#ffffff" opacity="0.5" />

      {/* Pattern */}
      <g dangerouslySetInnerHTML={{ __html: svgPattern }} />

      {/* Central function icon — communicates what the activity is about */}
      {icon && <g dangerouslySetInnerHTML={{ __html: icon }} />}

      {/* Activity-hint motifs */}
      {hints && <g dangerouslySetInnerHTML={{ __html: hints }} />}
    </svg>
  );
}
