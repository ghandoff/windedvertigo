/**
 * Intake routing — quadrant + free-text answers → event_type slug.
 *
 * Pure, table-driven. Easy to tune without touching any UI or routing
 * code. Every routing decision is logged with its `reason` so we can
 * audit decisions in CF Workers logs.
 *
 * Usage:
 *   const { slug, reason } = routeIntake({
 *     quadrant: 'people-design',
 *     quadrantHistory: ['people-design'],
 *     curious: '...',
 *     valuable: '...',
 *   });
 *   // → { slug: 'discovery', reason: 'people×design → broad team RR' }
 */

export interface Intake {
  quadrant: string | null;
  quadrantHistory: string[];
  curious: string;
  valuable: string;
}

export interface RoutingDecision {
  slug: string;
  reason: string;
}

interface Rule {
  match: (i: Intake) => boolean;
  slug: string;
  reason: string;
}

/**
 * Rules evaluated top-to-bottom; first match wins.
 *
 * Tuning notes:
 *   - keyword overrides come FIRST so explicit strategic intent
 *     ("partnership", "rfp") routes to the strategy collective
 *     regardless of which quadrant the visitor landed on
 *   - quadrant rules are next — they map cleanly to a single host
 *     specialty (or to discovery RR for the broadest quadrant)
 *   - quadrant-history fallback catches "explorers" who took the
 *     quiz multiple times — those are typically strategy-curious
 *   - default is `discovery` (round-robin) so no one ever lands
 *     on a dead-end fallback
 */
const RULES: Rule[] = [
  // Strategic intent keywords → strategy collective (Garrett + Maria)
  {
    match: (i) =>
      /\b(strateg(?:y|ic)|roadmap|partnership|funding|rfp|proposal|engagement)\b/i.test(
        `${i.curious} ${i.valuable}`,
      ),
    slug: "strategy",
    reason: "strategic intent keyword",
  },

  // Comms / outreach keywords → partnership collective (Garrett + Payton)
  {
    match: (i) =>
      /\b(comms|outreach|press|media|launch|campaign|brand)\b/i.test(`${i.curious} ${i.valuable}`),
    slug: "partnership",
    reason: "comms/outreach intent keyword",
  },

  // Quadrant-driven routing (single-host specialty)
  {
    match: (i) => i.quadrant === "people-design",
    slug: "discovery",
    reason: "people×design → broad team RR",
  },
  {
    match: (i) => i.quadrant === "people-research",
    slug: "lamis",
    reason: "people×research → Lamis solo",
  },
  {
    match: (i) => i.quadrant === "product-design",
    slug: "james",
    reason: "product×design → James solo",
  },
  {
    match: (i) => i.quadrant === "product-research",
    slug: "maria",
    reason: "product×research → Maria solo",
  },

  // Quadrant explorers → strategic conversation
  {
    match: (i) => i.quadrantHistory.length >= 3,
    slug: "strategy",
    reason: "3+ quadrants explored → strategic",
  },

  // Default: discovery round-robin (catches "no quadrant" + edge cases)
  { match: () => true, slug: "discovery", reason: "fallback round-robin" },
];

export function routeIntake(intake: Intake): RoutingDecision {
  for (const rule of RULES) {
    if (rule.match(intake)) {
      return { slug: rule.slug, reason: rule.reason };
    }
  }
  return { slug: "discovery", reason: "fallback (no rules matched)" };
}
