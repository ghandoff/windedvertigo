/**
 * Deterministic SVG illustration for pack cards.
 *
 * Unlike PlaydateIllustration (which maps to ~30 unique activities),
 * this uses a curated theme per known pack slug. Unknown slugs get a
 * generic branded pattern derived from the slug hash.
 *
 * Renders as a banner header (~100 px tall) on the pack card when
 * no cover_url is available.
 *
 * Note: dangerouslySetInnerHTML is safe here because all SVG content
 * is generated from deterministic, static data — no user input.
 */

/* ── brand colours (design tokens) ── */
const C = {
  champagne: "#ffebd2",
  sienna: "#cb7858",
  redwood: "#b15043",
  cadet: "#273248",
  white: "#ffffff",
} as const;

/* ── per-pack theme definitions ── */
interface PackTheme {
  emoji: string;
  label: string;
  /** Gradient stops for the banner background (left → right) */
  gradient: [string, string];
  /** Accent colour used for decorative shapes */
  accent: string;
  /** Pattern type */
  pattern: "grid" | "drops" | "sun" | "waves" | "stars" | "shapes";
}

const PACK_THEMES: Record<string, PackTheme> = {
  "classroom-starter": {
    emoji: "🏫",
    label: "classroom",
    gradient: [`${C.cadet}18`, `${C.champagne}40`],
    accent: C.cadet,
    pattern: "grid",
  },
  "new-baby-sibling": {
    emoji: "👶",
    label: "new sibling",
    gradient: [`${C.champagne}50`, `${C.sienna}15`],
    accent: C.sienna,
    pattern: "waves",
  },
  "rainy-day-rescue": {
    emoji: "🌧️",
    label: "rainy day",
    gradient: [`${C.cadet}15`, `${C.sienna}20`],
    accent: C.cadet,
    pattern: "drops",
  },
  "summer-play-camp": {
    emoji: "☀️",
    label: "summer",
    gradient: [`${C.champagne}45`, `${C.redwood}12`],
    accent: C.redwood,
    pattern: "sun",
  },
  "the-whole-collection": {
    emoji: "✨",
    label: "everything",
    gradient: [`${C.sienna}18`, `${C.champagne}35`],
    accent: C.sienna,
    pattern: "stars",
  },
  "co-design-essentials": {
    emoji: "🎨",
    label: "co-design",
    gradient: [`${C.redwood}15`, `${C.sienna}20`],
    accent: C.redwood,
    pattern: "shapes",
  },
};

/* ── hash utility ── */
function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash << 5) - hash + slug.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seeded(seed: number, idx: number): number {
  const x = Math.sin((seed + idx) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/* ── pattern renderers ── */

function renderGrid(accent: string, seed: number, w: number, h: number): string {
  let s = "";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 12 + col * (w - 24) / 3;
      const y = 10 + row * (h - 20) / 2;
      const size = 6 + seeded(seed, row * 4 + col) * 4;
      const rot = -10 + seeded(seed, 30 + row * 4 + col) * 20;
      const op = 0.08 + seeded(seed, 60 + row * 4 + col) * 0.12;
      s += `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="1"
             fill="${accent}" opacity="${op}"
             transform="translate(${x},${y}) rotate(${rot})" />`;
    }
  }
  return s;
}

function renderDrops(accent: string, seed: number, w: number, h: number): string {
  let s = "";
  const count = 10 + Math.floor(seeded(seed, 0) * 6);
  for (let i = 0; i < count; i++) {
    const x = seeded(seed, 10 + i) * w;
    const y = seeded(seed, 20 + i) * h;
    const r = 1.5 + seeded(seed, 30 + i) * 2.5;
    const op = 0.06 + seeded(seed, 40 + i) * 0.12;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" opacity="${op}" />`;
  }
  for (let i = 0; i < 5; i++) {
    const x = seeded(seed, 50 + i) * w;
    const y1 = seeded(seed, 60 + i) * h * 0.3;
    const y2 = y1 + 10 + seeded(seed, 70 + i) * 15;
    s += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"
           stroke="${accent}" stroke-width="0.8" opacity="0.08" stroke-linecap="round" />`;
  }
  return s;
}

function renderSun(accent: string, seed: number, w: number, h: number): string {
  let s = "";
  const cx = w * 0.65;
  const cy = h * 0.35;
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 * Math.PI) / 180;
    const r1 = 10 + seeded(seed, i) * 4;
    const r2 = r1 + 8 + seeded(seed, 20 + i) * 6;
    const x1 = cx + Math.cos(angle) * r1;
    const y1 = cy + Math.sin(angle) * r1;
    const x2 = cx + Math.cos(angle) * r2;
    const y2 = cy + Math.sin(angle) * r2;
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
           stroke="${accent}" stroke-width="1.2" opacity="0.1" stroke-linecap="round" />`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="8" fill="${accent}" opacity="0.1" />`;
  s += `<circle cx="${cx}" cy="${cy}" r="4" fill="${accent}" opacity="0.08" />`;
  return s;
}

function renderWaves(accent: string, seed: number, w: number, h: number): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    const y0 = 15 + i * (h - 30) / 3;
    const amp = 5 + seeded(seed, i) * 4;
    let d = `M 0 ${y0}`;
    for (let x = 0; x <= w; x += 5) {
      const y = y0 + amp * Math.sin(x * 0.08 + i * 1.5 + seeded(seed, 10 + i));
      d += ` L ${x} ${y}`;
    }
    s += `<path d="${d}" stroke="${accent}" stroke-width="1.2" fill="none" opacity="${0.06 + i * 0.02}" />`;
  }
  return s;
}

function renderStars(accent: string, seed: number, w: number, h: number): string {
  let s = "";
  const count = 8 + Math.floor(seeded(seed, 0) * 5);
  for (let i = 0; i < count; i++) {
    const x = seeded(seed, 10 + i) * w;
    const y = seeded(seed, 20 + i) * h;
    const size = 2 + seeded(seed, 30 + i) * 3;
    const op = 0.08 + seeded(seed, 40 + i) * 0.12;
    s += `<path d="M${x} ${y - size}L${x + size * 0.3} ${y}L${x} ${y + size}L${x - size * 0.3} ${y}Z"
           fill="${accent}" opacity="${op}" />`;
  }
  return s;
}

function renderShapes(accent: string, seed: number, w: number, h: number): string {
  let s = "";
  const shapeTypes = ["circle", "rect", "diamond"] as const;
  const count = 7 + Math.floor(seeded(seed, 0) * 4);
  for (let i = 0; i < count; i++) {
    const x = seeded(seed, 10 + i) * w;
    const y = seeded(seed, 20 + i) * h;
    const size = 4 + seeded(seed, 30 + i) * 6;
    const op = 0.06 + seeded(seed, 40 + i) * 0.1;
    const type = shapeTypes[Math.floor(seeded(seed, 50 + i) * shapeTypes.length)];
    if (type === "circle") {
      s += `<circle cx="${x}" cy="${y}" r="${size}" fill="${accent}" opacity="${op}" />`;
    } else if (type === "rect") {
      const rot = seeded(seed, 60 + i) * 45;
      s += `<rect x="${-size}" y="${-size}" width="${size * 2}" height="${size * 2}" rx="1"
             fill="${accent}" opacity="${op}"
             transform="translate(${x},${y}) rotate(${rot})" />`;
    } else {
      s += `<path d="M${x} ${y - size}L${x + size} ${y}L${x} ${y + size}L${x - size} ${y}Z"
             fill="${accent}" opacity="${op}" />`;
    }
  }
  return s;
}

const RENDERERS: Record<PackTheme["pattern"], typeof renderGrid> = {
  grid: renderGrid,
  drops: renderDrops,
  sun: renderSun,
  waves: renderWaves,
  stars: renderStars,
  shapes: renderShapes,
};

/* ── fallback theme for unknown slugs ── */
const FALLBACK_ACCENTS = [C.sienna, C.redwood, C.cadet, C.champagne];
const FALLBACK_PATTERNS: PackTheme["pattern"][] = ["shapes", "waves", "stars", "grid"];
const FALLBACK_EMOJIS = ["📦", "🎁", "🧶", "🎪"];

function getFallbackTheme(slug: string): PackTheme {
  const h = hashSlug(slug);
  const idx = h % FALLBACK_ACCENTS.length;
  return {
    emoji: FALLBACK_EMOJIS[idx],
    label: "pack",
    gradient: [`${FALLBACK_ACCENTS[idx]}18`, `${C.champagne}30`],
    accent: FALLBACK_ACCENTS[idx],
    pattern: FALLBACK_PATTERNS[idx],
  };
}

/* ── public API ── */

export function getPackTheme(slug: string): PackTheme {
  return PACK_THEMES[slug] ?? getFallbackTheme(slug);
}

interface PackIllustrationProps {
  slug: string;
  height?: number;
}

export function PackIllustration({ slug, height = 100 }: PackIllustrationProps) {
  const theme = getPackTheme(slug);
  const seed = hashSlug(slug);
  const w = 400;
  const render = RENDERERS[theme.pattern];
  const patternSvg = render(theme.accent, seed, w, height);

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      style={{ height: `${height}px`, display: "block" }}
      aria-hidden="true"
    >
      {/* gradient background */}
      <defs>
        <linearGradient id={`pg-${slug}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={theme.gradient[0]} />
          <stop offset="100%" stopColor={theme.gradient[1]} />
        </linearGradient>
      </defs>
      <rect width={w} height={height} fill={`url(#pg-${slug})`} />

      {/* decorative pattern — generated from static data, no user input */}
      <g dangerouslySetInnerHTML={{ __html: patternSvg }} />

      {/* centred emoji */}
      <text
        x={w / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="28"
        opacity="0.35"
      >
        {theme.emoji}
      </text>
    </svg>
  );
}
