export type Collaborator = {
  /** Display name / alt text */
  name: string;
  /**
   * Path to logo in /public/collaborators/.
   * Spaces must be %20-encoded. Leave undefined for text-only.
   */
  logoPath?: string;
  /**
   * true  = active ongoing project → higher opacity in animations
   * false = past collaborator      → lower opacity
   */
  current: boolean;
};

/**
 * Master collaborator list — order here is display order.
 * Interleaved current/past so full and partial opacity alternate.
 * 9 active · 10 past · 19 total
 *
 * To add a logo: drop file into site/public/collaborators/,
 * add logoPath here (URL-encode spaces as %20).
 */
export const COLLABORATORS: Collaborator[] = [
  { name: "UN global compact",                   logoPath: "/collaborators/prme_logo_short_white.png",                  current: true  },
  { name: "LEGO playful learning museums network",logoPath: "/collaborators/LEGO%20PLayful%20Learning%20Museum%20Network.png", current: false },
  { name: "LEGO foundation",                      logoPath: "/collaborators/LEGO-Fonden.png",                           current: true  },
  { name: "exploratorium",                        logoPath: "/collaborators/exploratorium.png",                         current: false },
  { name: "press play",                           logoPath: "/collaborators/press%20play.png",                          current: true  },
  { name: "aarhus university",                    logoPath: "/collaborators/aarhus%20universitet.png",                  current: false },
  { name: "history.co:lab",                       logoPath: "/collaborators/history%20colab.webp",                      current: true  },
  { name: "thinkery",                             logoPath: "/collaborators/thinkery.png",                              current: false },
  { name: "care for education",                   logoPath: "/collaborators/care%20for%20education.png",                current: true  },
  { name: "oikos international",                  logoPath: "/collaborators/Oikos_International.png",                   current: false },
  { name: "education for sharing",                logoPath: "/collaborators/education%20for%20sharing.png",             current: true  },
  { name: "creativity, culture and education",    logoPath: "/collaborators/cce_logo.png",                              current: false },
  { name: "nordic naturals",                      logoPath: "/collaborators/nordic_naturals.png",                       current: true  },
  { name: "bay area discovery museum",            logoPath: "/collaborators/BADM%20logo.png",                           current: false },
  { name: "sesame workshop",                      logoPath: "/collaborators/Sesame-Workshop-logo.png",                  current: true  },
  { name: "rigamajig",                            logoPath: "/collaborators/Rigamajig-logo-web.png",                    current: false },
  { name: "lightbulb learning lab",               logoPath: undefined,                                                  current: true  },
  { name: "scratch",                              logoPath: "/collaborators/Scratch-Emblem.png",                        current: false },
  { name: "epfl",                                 logoPath: "/collaborators/EPFL.png",                                  current: false },
];
