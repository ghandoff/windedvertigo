export type Collaborator = {
  /** Display name / alt text */
  name: string;
  /**
   * Path to logo in /public/collaborators/.
   * Spaces must be %20-encoded. Leave undefined for text-only.
   */
  logoPath?: string;
  /**
   * true  = active ongoing project → opacity 0.55
   * false = past collaborator      → opacity 0.28
   */
  current: boolean;
};

/**
 * Master collaborator list — order here is marquee order.
 * Mix current + past for visual rhythm.
 *
 * current=true  → PRME 2026, Sesame Workshop, Press Play (active projects/partners)
 * current=false → past collaborations / career history
 *
 * To add a logo: drop file into site/public/collaborators/, add logoPath here,
 * set opaque:true for JPEGs or non-transparent images.
 */
export const COLLABORATORS: Collaborator[] = [
  // ── active ──────────────────────────────────────────────────────
  {
    name: "prme",
    logoPath: "/collaborators/prme_logo_short_white.png",
    current: true,
  },
  {
    name: "press play",
    logoPath: "/collaborators/press%20play.png",
    current: true,
  },
  {
    name: "history colab",
    logoPath: "/collaborators/history%20colab.webp",
    current: true,
  },
  {
    name: "care for education",
    logoPath: "/collaborators/care%20for%20education.png",
    current: true,
  },
  {
    name: "education for sharing",
    logoPath: "/collaborators/education%20for%20sharing.png",
    current: true,
  },
  {
    name: "nordic naturals",
    logoPath: "/collaborators/nordic_naturals.png",
    current: true,
  },

  // ── past ────────────────────────────────────────────────────────
  {
    name: "sesame workshop",
    logoPath: "/collaborators/Sesame-Workshop-logo.png",
    current: false,
  },
  {
    name: "lego playful learning museum network",
    logoPath: "/collaborators/LEGO%20PLayful%20Learning%20Museum%20Network.png",
    current: false,
  },
  {
    name: "exploratorium",
    logoPath: "/collaborators/exploratorium.png",
    current: false,
  },
  {
    name: "scratch",
    logoPath: "/collaborators/Scratch-Emblem.png",
    current: false,
  },
  {
    name: "aarhus university",
    logoPath: "/collaborators/aarhus%20universitet.png",
    current: false,
  },
  {
    name: "epfl",
    logoPath: "/collaborators/EPFL.png",
    current: false,
  },
  {
    name: "thinkery",
    logoPath: "/collaborators/thinkery.png",
    current: false,
  },
  {
    name: "oikos international",
    logoPath: "/collaborators/Oikos_International.png",
    current: false,
  },
  {
    name: "cce",
    logoPath: "/collaborators/cce_logo.png",
    current: false,
  },
  {
    name: "badm",
    logoPath: "/collaborators/BADM%20logo.png",
    current: false,
  },
  {
    name: "lego foundation",
    logoPath: "/collaborators/LEGO-Fonden.png",
    current: true,
  },
  {
    name: "rigamajig",
    logoPath: "/collaborators/Rigamajig-logo-web.png",
    current: false,
  },
];
