/**
 * canonical w.v methodology blocks — mirrors the canonical source at
 * ghandoff/wv-proposals/_lib/methodology-blocks.md. served by
 * /api/port/evidence-search as `kind: "methodology"` results.
 *
 * phase 2 (later): swap the in-file constant for a github-backed read of the
 * markdown so blocks stay in sync without redeploying the port.
 */

export interface MethodologyBlock {
  id: string;
  title: string;
  /** 1-2 sentence summary, capped ~200 chars. */
  snippet: string;
  tags: string[];
}

export const METHODOLOGY_BLOCKS: MethodologyBlock[] = [
  {
    id: "co-design",
    title: "Co-design",
    snippet:
      "w.v works with practitioners and learners, not on them — stakeholder mapping early, at least one round of practitioner review before any deliverable lands, cultural-appropriateness lead reviews every framework.",
    tags: ["co-design", "participatory", "practitioner", "stakeholder", "cultural fit"],
  },
  {
    id: "evidence-loop",
    title: "Evidence loop",
    snippet:
      "Baseline → theory of change → indicators → mid-point review → evidence synthesis. The spine of every w.v engagement, not a separate MEL workstream bolted on at the end.",
    tags: ["mel", "evaluation", "evidence", "theory of change", "indicators", "synthesis", "baseline"],
  },
  {
    id: "competency-based-design",
    title: "Competency-based design",
    snippet:
      "For curriculum, training, and learning materials: 3–6 target competencies per engagement, each tied to a learning experience and an evidence indicator, sequenced by complexity not by module.",
    tags: ["curriculum", "training", "learning design", "competency", "competencies", "assessment"],
  },
  {
    id: "train-the-trainer",
    title: "Train-the-trainer architecture",
    snippet:
      "Three-layer pattern: master facilitators, practitioner facilitators, reflective practice infrastructure. Framed as a system the client owns at the end of the engagement, not a series of workshops.",
    tags: [
      "train-the-trainer",
      "facilitation",
      "capacity building",
      "facilitators",
      "system",
      "lamis",
    ],
  },
  {
    id: "sense-making",
    title: "Sense-making",
    snippet:
      "For complex evidence (mixed methods, multi-site, long timeframes): hold both the quantitative signal and the practitioner narrative simultaneously, treat them as complementary rather than competing.",
    tags: ["sense-making", "mixed methods", "qualitative", "quantitative", "analysis", "synthesis"],
  },
  {
    id: "value-prop-language",
    title: "Value-prop language",
    snippet:
      "Earn-their-keep phrases: evidence-grounded not evidence-decorated; designed for practitioners not just funders; a system the client keeps using; naming constraints honestly. Avoid robust, leverage synergies, impactful, best-in-class.",
    tags: ["value prop", "voice", "messaging", "brand", "narrative"],
  },
  {
    id: "funder-framing-un",
    title: "Funder framing — UN system",
    snippet:
      "PRME, UNICEF, UN Global Compact: lead with policy alignment (relevant SDGs, the client's published framework), name cross-country fit explicitly, anchor in Garrett's PRME track record.",
    tags: ["un", "prme", "unicef", "un global compact", "sdg", "policy", "funder"],
  },
  {
    id: "funder-framing-idb",
    title: "Funder framing — IDB / development banks",
    snippet:
      "Maria leads contextual framing for LatAm bids. Name the local-partner approach explicitly (the bank usually requires it), reference IDB Salvador track record and procurement-process familiarity.",
    tags: ["idb", "development bank", "latin america", "latam", "salvador", "procurement", "funder"],
  },
  {
    id: "funder-framing-foundations",
    title: "Funder framing — Foundations",
    snippet:
      "Less procurement-heavy, more programme-fit. Lead with the theory of change and what the foundation's portfolio gains from funding this work. Foundations buy clarity of conviction — write with a point of view.",
    tags: ["foundation", "philanthropy", "theory of change", "programme fit", "funder"],
  },
];
