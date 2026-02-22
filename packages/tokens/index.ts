/**
 * @windedvertigo/tokens — JS/TS constants
 *
 * use these when CSS variables aren't available
 * (server-side pdf generation, email templates, docx builds, etc.)
 */

/* ── brand palette ──────────────────────────────────────────────── */

export const brand = {
  cadet:     "#273248",
  redwood:   "#b15043",
  sienna:    "#cb7858",
  champagne: "#ffebd2",
  white:     "#ffffff",
} as const;

/* ── semantic colours ───────────────────────────────────────────── */

export const semantic = {
  textPrimary:       brand.cadet,
  textSecondary:     "#4b5563",
  textMuted:         "#6b7280",
  textOnDark:        brand.champagne,
  textOnDarkMuted:   "rgba(255, 235, 210, 0.85)",

  focus:             "#3B82F6",
  link:              "#1e40af",
  linkOnDark:        "#93c5fd",

  accent:            brand.redwood,
  accentHover:       brand.sienna,
  accentOnDark:      "#e09878",
  surfaceRaised:     "#1e2738",

  error:             "#7c2d12",
  errorBg:           "#fee2e2",
  errorBorder:       "#dc2626",
  success:           "#15803d",
  successVivid:      "#2a9d50",
  successBg:         "#dcfce7",
  successBorder:     "#22c55e",
  warning:           "#78350f",
  warningBg:         "#fef3c7",
  warningBorder:     "#f59e0b",
} as const;

/* ── spacing (px) ───────────────────────────────────────────────── */

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  "2xl": 48,
  "3xl": 64,
} as const;

/* ── typography ─────────────────────────────────────────────────── */

export const typography = {
  fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  lineHeight: 1.6,
  letterSpacing: "0.02em",
  maxLineLength: "70ch",
} as const;
