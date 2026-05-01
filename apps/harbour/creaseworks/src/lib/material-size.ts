/**
 * material-size — order materials by real-world physical size.
 *
 * The classic picker renders all materials as one continuous scroll
 * from small (buttons, beads) to big (trash bin, large cardboard box).
 * Kids orient themselves by size — no pre-assigned function buckets,
 * no drop-down reveals to fight. Scroll = size axis.
 *
 * Rules are keyword substrings matched against the material title.
 * Evaluated top-to-bottom, first match wins. Multi-word phrases come
 * before single-word keywords so "paper clip" wins over "paper".
 *
 * If nothing matches, we fall back to a `form_primary`-derived default
 * (a teaspoon-scale assumption for each character host), then finally
 * to 500 ("medium, shrug"). That way new DB entries don't explode —
 * they just land in the middle until someone writes a rule.
 *
 * Rank is a dimensionless number in roughly 100-1100 range. What
 * matters is monotonicity, not the absolute value.
 */

/* ── size rules: ordered smallest → biggest, specific → general ──── */

const SIZE_RULES: Array<{ keywords: string[]; rank: number }> = [
  /* 100s — grain of rice to fingernail scale */
  { keywords: ["googly eye"], rank: 110 },
  { keywords: ["sequin"], rank: 120 },
  { keywords: ["plastic bead", "bead"], rank: 130 },
  { keywords: ["button"], rank: 150 },
  { keywords: ["paper clip", "paperclip"], rank: 160 },
  { keywords: ["binder clip"], rank: 170 },
  { keywords: ["rubber band"], rank: 180 },
  { keywords: ["bottle cap"], rank: 190 },

  /* 200s — small craft tokens (coin, die, cork, marshmallow) */
  { keywords: ["small part"], rank: 210 },
  { keywords: ["toothpick"], rank: 220 },
  { keywords: ["nail"], rank: 230 },
  { keywords: ["wire"], rank: 240 },
  { keywords: ["zip tie"], rank: 250 },
  { keywords: ["cork"], rank: 260 },
  { keywords: ["dice"], rank: 270 },
  { keywords: ["cotton ball"], rank: 280 },
  { keywords: ["marshmallow"], rank: 285 },
  { keywords: ["clothespin"], rank: 290 },
  { keywords: ["popsicle stick"], rank: 295 },

  /* 300s — pencil-length items */
  { keywords: ["straw"], rank: 310 },
  { keywords: ["pipe cleaner"], rank: 320 },
  { keywords: ["feather"], rank: 330 },
  { keywords: ["colored pencil"], rank: 340 },
  { keywords: ["dry-erase marker"], rank: 350 },
  { keywords: ["washable marker"], rank: 355 },
  { keywords: ["highlighter"], rank: 360 },
  { keywords: ["chalk"], rank: 370 },
  { keywords: ["rubber stamp"], rank: 380 },
  { keywords: ["glue stick", "glue ("], rank: 385 },
  { keywords: ["mark-maker"], rank: 390 },

  /* 400s — flat strip goods: string/ribbon/tape */
  { keywords: ["string / yarn", "string/yarn", "yarn"], rank: 410 },
  { keywords: ["twine"], rank: 420 },
  { keywords: ["ribbon"], rank: 430 },
  { keywords: ["washi tape"], rank: 440 },
  { keywords: ["velcro strip"], rank: 445 },
  { keywords: ["velcro"], rank: 450 },
  { keywords: ["tape ("], rank: 455 },
  { keywords: ["sticker"], rank: 460 },
  { keywords: ["sticky note"], rank: 465 },
  { keywords: ["foam shape"], rank: 470 },
  { keywords: ["styrofoam ball"], rank: 480 },
  { keywords: ["bracelet"], rank: 490 },

  /* 500s — card/envelope/small flat paper + generic natural small objects */
  { keywords: ["playing card"], rank: 510 },
  { keywords: ["index card"], rank: 515 },
  { keywords: ["letter tile", "alphabet letter"], rank: 520 },
  { keywords: ["envelope"], rank: 525 },
  { keywords: ["receipt", "ticket", "ephemera"], rank: 530 },
  { keywords: ["name badge", "lanyard"], rank: 535 },
  { keywords: ["sock"], rank: 540 },
  { keywords: ["pinecone"], rank: 550 },
  { keywords: ["pool noodle"], rank: 560 },
  { keywords: ["dirt", "mud"], rank: 580 },
  { keywords: ["found object", "surface"], rank: 590 },

  /* 600s — hand-tools + small cups */
  { keywords: ["hole punch"], rank: 610 },
  { keywords: ["stapler"], rank: 620 },
  { keywords: ["scissors"], rank: 630 },
  { keywords: ["paper cup"], rank: 640 },
  { keywords: ["hot glue gun"], rank: 680 },
  { keywords: ["toy part"], rank: 690 },
  /* paper plate + muffin tin were here at 650/665; per Garrett's
     reorder (2026-04-22) they belong in the 800s with shoebox —
     they're plate-sized kitchen vessels, bigger than bubble wrap.  */

  /* 700s — letter-sized paper / tubes / small cloth; plastic bottles,
     lego bins, packing foam tucked in at the high end of this tier
     per Garrett's reorder — bigger than aluminum foil but smaller
     than shoebox-scale kitchenware.                                 */
  { keywords: ["toilet paper"], rank: 710 },
  { keywords: ["cardboard tube", "mailing tube", "wrapping paper"], rank: 720 },
  { keywords: ["egg carton"], rank: 725 },
  { keywords: ["aluminum foil"], rank: 730 },
  { keywords: ["bubble wrap"], rank: 735 },
  { keywords: ["plastic bottle"], rank: 738 },
  { keywords: ["lego"], rank: 740 },
  { keywords: ["packing foam", "sponge block"], rank: 742 },
  { keywords: ["tracing paper"], rank: 745 },
  { keywords: ["translucent plastic"], rank: 748 },
  { keywords: ["cardstock"], rank: 750 },
  { keywords: ["construction paper"], rank: 755 },
  { keywords: ["felt sheet"], rank: 760 },
  { keywords: ["cloth scrap", "fabric swatch"], rank: 765 },
  { keywords: ["bandana", "small cloth"], rank: 770 },
  { keywords: ["hat", "paper crown"], rank: 775 },
  { keywords: ["corrugated cardboard"], rank: 780 },
  { keywords: ["paper bag"], rank: 785 },
  { keywords: ["paper wireframe", "ui template"], rank: 790 },
  { keywords: ["map"], rank: 795 },
  { keywords: ["magazine picture", "postcard"], rank: 798 },

  /* 800s — shoeboxes, plate-sized kitchen vessels, bulk craft */
  { keywords: ["paper plate"], rank: 805 },
  { keywords: ["shoebox", "shoe box"], rank: 810 },
  { keywords: ["muffin tin", "ice cube tray"], rank: 815 },
  { keywords: ["styrofoam board", "foam block"], rank: 845 },
  { keywords: ["clothing accessor", "caps/", "tee-shirt"], rank: 860 },
  { keywords: ["tablecloth"], rank: 880 },

  /* 900s — big paper, rolls, bulky tech */
  { keywords: ["big paper", "flip chart", "large sheet"], rank: 910 },
  { keywords: ["kraft paper", "butcher paper"], rank: 920 },
  { keywords: ["obsolete tech", "calculator", "circuit"], rank: 930 },

  /* 1000+ — large boxes, bins */
  { keywords: ["large cardboard", "big cardboard", "book size"], rank: 1010 },
  { keywords: ["trash bin", "large container"], rank: 1100 },
];

/* ── form_primary fallback baseline ────────────────────────────────
   when the title doesn't match any rule we fall back on the form
   character's typical scale — cord is twine-ish (small), jugs is
   bottle-ish (medium), etc.                                         */

const FORM_DEFAULTS: Record<string, number> = {
  cord: 350,    // flexible-linear (string, ribbon, pipe cleaner)
  twig: 400,    // rigid-linear (pencil, stick, straw)
  swatch: 760,  // flat-soft (paper, fabric, foil)
  jugs: 820,    // rigid-hollow (bottle, jar)
  crate: 830,   // rigid-box (shoebox, lego set)
  mud: 500,     // malleable (clay, dough lump)
  drip: 400,    // liquid (small pool)
};

const MEDIUM_DEFAULT = 500;

/* word-boundary-ish match: "wire" matches "wire" or "wires" but NOT
   "wireframe". the pattern is `\bKEYWORD(s|es)?\b` — leading word
   boundary + optional plural suffix + trailing word boundary. this
   handles the plural mismatch that pure `\bkeyword\b` failed on
   ("googly eye" rule vs "googly eyes" title) without letting
   "wire" invade "wireframe". cached since rules evaluate many times.  */

const BOUNDARY_CACHE = new Map<string, RegExp>();
function boundaryRegex(keyword: string): RegExp {
  let re = BOUNDARY_CACHE.get(keyword);
  if (!re) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`\\b${escaped}(s|es)?\\b`, "i");
    BOUNDARY_CACHE.set(keyword, re);
  }
  return re;
}

/**
 * Physical-size rank for a material. Lower = smaller.
 * Unknown titles fall back to form_primary baseline, then to 500.
 */
export function getSizeRank(material: {
  title: string;
  form_primary?: string | null;
}): number {
  const title = material.title;
  for (const rule of SIZE_RULES) {
    for (const kw of rule.keywords) {
      if (boundaryRegex(kw).test(title)) return rule.rank;
    }
  }
  const form = material.form_primary?.toLowerCase();
  if (form && FORM_DEFAULTS[form] !== undefined) return FORM_DEFAULTS[form];
  return MEDIUM_DEFAULT;
}

/**
 * Sort materials smallest to biggest. Stable: ties break on title
 * alphabetically so the UI doesn't jitter between renders.
 */
export function sortMaterialsBySize<
  T extends { id: string; title: string; form_primary?: string | null },
>(materials: T[]): T[] {
  return [...materials].sort((a, b) => {
    const ra = getSizeRank(a);
    const rb = getSizeRank(b);
    if (ra !== rb) return ra - rb;
    return a.title.localeCompare(b.title);
  });
}

/* ── size tiers: visual anchors for non-reader kids ─────────────
   Replace the old "↑ small stuff / big stuff ↓" text hint in the
   classic picker with these milestone bands. Each tier has a big
   emoji (reads instantly), a one-word label (for older kids and
   parents), and a rank range. A tier change between adjacent
   materials in the sorted list triggers a sticky band at that
   row of the grid — natural rest points for kids scrolling the
   long list.                                                       */

export interface SizeTier {
  key: string;
  emoji: string;
  label: string;
  minRank: number;
}

export const SIZE_TIERS: readonly SizeTier[] = [
  { key: "tiny",   emoji: "🫘", label: "tiny things",   minRank: 0   },
  { key: "small",  emoji: "✏️", label: "small stuff",    minRank: 300 },
  { key: "medium", emoji: "📄", label: "medium things", minRank: 500 },
  { key: "big",    emoji: "📦", label: "big stuff",     minRank: 700 },
  { key: "huge",   emoji: "🗑️", label: "the huge ones", minRank: 900 },
] as const;

/** Resolve a rank (100–1100) to its visual tier. O(n) linear scan
 *  over 5 entries — trivially cheap. */
export function getSizeTier(rank: number): SizeTier {
  let match: SizeTier = SIZE_TIERS[0];
  for (const tier of SIZE_TIERS) {
    if (rank >= tier.minRank) match = tier;
  }
  return match;
}
