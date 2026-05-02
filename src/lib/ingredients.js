/**
 * Ingredient keyword matching for PCS Evidence Library backfill
 *
 * Maps text content (titles, citations, summaries) to Ingredient multi-select
 * values by matching against known synonyms, chemical names, and brand terms.
 *
 * The match list mirrors the Evidence Library `Ingredient` multi-select options:
 *   EPA, DHA, Omega-3 (general), Vitamin D, Magnesium, CoQ10,
 *   Curcumin, Vitamin K2, Probiotics, Other
 */

const INGREDIENT_PATTERNS = [
  {
    name: 'EPA',
    patterns: [/\bepa\b/i, /eicosapentaenoic/i],
  },
  {
    name: 'DHA',
    patterns: [/\bdha\b/i, /docosahexaenoic/i],
  },
  {
    name: 'Omega-3 (general)',
    patterns: [
      /omega[\s-]?3/i,
      /fish\s*oil/i,
      /\bn[\s-]?3\s*(pufa|fatty)/i,
      /\bpufa\b/i,
      /\blc[\s-]?pufa\b/i,
    ],
  },
  {
    name: 'Vitamin D',
    patterns: [
      /vitamin\s*d[23]?\b/i,
      /cholecalciferol/i,
      /ergocalciferol/i,
      /25[\s(]*oh[\s)]*d/i,
      /calcidiol/i,
      /calcitriol/i,
    ],
  },
  {
    name: 'Magnesium',
    patterns: [
      /magnesium/i,
    ],
  },
  {
    name: 'CoQ10',
    patterns: [
      /co\s*q\s*10/i,
      /coenzyme\s*q/i,
      /ubiquinon/i,
      /ubiquinol/i,
    ],
  },
  {
    name: 'Curcumin',
    patterns: [
      /curcumin/i,
      /turmeric/i,
      /curcuma/i,
    ],
  },
  {
    name: 'Vitamin K2',
    patterns: [
      /vitamin\s*k\s*2/i,
      /menaquinone/i,
      /\bmk[\s-]?7\b/i,
      /\bmk[\s-]?4\b/i,
    ],
  },
  {
    name: 'Probiotics',
    patterns: [
      /probiotic/i,
      /lactobacill/i,
      /bifidobacter/i,
      /saccharomyces/i,
      /streptococcus\s*thermophil/i,
    ],
  },
];

/**
 * Detect ingredients from text content.
 * Concatenates all input fields and runs each pattern set against the combined text.
 *
 * @param {{ name?: string, citation?: string, summary?: string }} fields
 * @returns {string[]} matched ingredient names (deduped, sorted)
 */
export function detectIngredients({ name = '', citation = '', summary = '' }) {
  const text = [name, citation, summary].join(' ');
  if (!text.trim()) return [];

  const matched = new Set();
  for (const { name: ingredient, patterns } of INGREDIENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        matched.add(ingredient);
        break; // one pattern match per ingredient is enough
      }
    }
  }

  return [...matched].sort();
}

/**
 * Export patterns for testing or extending
 */
export { INGREDIENT_PATTERNS };
