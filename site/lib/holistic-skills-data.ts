// holistic skills framework — data source of truth.
//
// the page at /portfolio/holistic-skills-framework/ renders directly from this
// file. to update the framework, edit SKILL_SETS and SKILLS below — no other
// code changes needed.
//
// PLACEHOLDER NOTE: this dataset is a sketch drawn from established holistic
// skills frameworks (CASEL for social/behavioral, WEF/OECD for cognitive) so
// the page has structural integrity from day one. swap these constants for
// the canonical w.v framework data when ready — the page renders any
// (skills, skill_sets, connections) shape that matches the types below.

export type SkillType = "cognitive" | "social" | "behavioral";

export interface SkillSet {
  id: string;
  label: string;
  description: string;
  /** w.v programmes/engagements that develop this skill set. optional. */
  programmes?: string[];
}

export interface Skill {
  id: string;
  label: string;
  type: SkillType;
  /** ids of every skill set this skill contributes to. a skill may belong to multiple sets. */
  skillSetIds: string[];
  /** one to two sentence definition shown in the detail drawer. */
  definition?: string;
  /** w.v programmes/engagements that develop this skill. optional. */
  programmes?: string[];
  /** representative learning activities. optional. */
  examples?: string[];
}

export const SKILL_SETS: SkillSet[] = [
  {
    id: "critical-thinking",
    label: "critical thinking",
    description: "the ability to interrogate information, surface assumptions, and reason toward defensible conclusions.",
  },
  {
    id: "creative-expression",
    label: "creative expression",
    description: "generating, refining, and sharing original ideas across modalities.",
  },
  {
    id: "collaboration",
    label: "collaboration",
    description: "working productively with others toward shared outcomes, across difference.",
  },
  {
    id: "self-direction",
    label: "self-direction",
    description: "setting goals, managing effort, and adjusting course without external prompting.",
  },
  {
    id: "global-citizenship",
    label: "global citizenship",
    description: "understanding interconnected systems and acting with care across cultural and ecological contexts.",
  },
  {
    id: "emotional-intelligence",
    label: "emotional intelligence",
    description: "noticing, naming, and navigating emotion — in oneself and in others.",
  },
];

export const SKILLS: Skill[] = [
  // ── cognitive ─────────────────────────────────────────────
  {
    id: "analytical-reasoning",
    label: "analytical reasoning",
    type: "cognitive",
    skillSetIds: ["critical-thinking", "self-direction"],
    definition: "breaking complex information into parts, examining relationships, and drawing logical conclusions.",
  },
  {
    id: "problem-solving",
    label: "problem solving",
    type: "cognitive",
    skillSetIds: ["critical-thinking", "creative-expression"],
    definition: "defining a challenge clearly, generating options, and selecting an approach with awareness of constraints.",
  },
  {
    id: "metacognition",
    label: "metacognition",
    type: "cognitive",
    skillSetIds: ["self-direction", "critical-thinking"],
    definition: "noticing how you're thinking — your strategies, biases, and gaps — and adjusting accordingly.",
  },
  {
    id: "divergent-thinking",
    label: "divergent thinking",
    type: "cognitive",
    skillSetIds: ["creative-expression", "critical-thinking"],
    definition: "generating many ideas or possibilities from a single starting point, without prematurely converging.",
  },
  {
    id: "pattern-recognition",
    label: "pattern recognition",
    type: "cognitive",
    skillSetIds: ["critical-thinking", "creative-expression"],
    definition: "identifying recurring structures, signals, or rhythms across information that might otherwise feel chaotic.",
  },
  {
    id: "systems-thinking",
    label: "systems thinking",
    type: "cognitive",
    skillSetIds: ["global-citizenship", "critical-thinking"],
    definition: "understanding how parts of a whole interact, including feedback loops, delays, and unintended consequences.",
  },

  // ── social ────────────────────────────────────────────────
  {
    id: "active-listening",
    label: "active listening",
    type: "social",
    skillSetIds: ["collaboration", "emotional-intelligence"],
    definition: "receiving what's said with full attention, reflecting back to confirm understanding, and creating space for what's unsaid.",
  },
  {
    id: "perspective-taking",
    label: "perspective taking",
    type: "social",
    skillSetIds: ["collaboration", "global-citizenship", "emotional-intelligence"],
    definition: "imagining how a situation looks, feels, and matters from another's vantage point.",
  },
  {
    id: "conflict-resolution",
    label: "conflict resolution",
    type: "social",
    skillSetIds: ["collaboration", "emotional-intelligence"],
    definition: "surfacing tension constructively, separating positions from interests, and finding paths that honor multiple needs.",
  },
  {
    id: "communication",
    label: "communication",
    type: "social",
    skillSetIds: ["collaboration", "creative-expression"],
    definition: "shaping ideas for an audience and choosing the form — words, images, gesture, silence — that lands them.",
  },
  {
    id: "cultural-awareness",
    label: "cultural awareness",
    type: "social",
    skillSetIds: ["global-citizenship", "collaboration"],
    definition: "noticing the assumptions and norms shaping yourself and others, especially across difference.",
  },
  {
    id: "empathy",
    label: "empathy",
    type: "social",
    skillSetIds: ["emotional-intelligence", "collaboration", "global-citizenship"],
    definition: "feeling alongside someone — not as projection, but as accompaniment — without losing your own grounding.",
  },

  // ── behavioral ────────────────────────────────────────────
  {
    id: "self-regulation",
    label: "self-regulation",
    type: "behavioral",
    skillSetIds: ["self-direction", "emotional-intelligence"],
    definition: "noticing your inner state and responding with intention rather than reflex.",
  },
  {
    id: "adaptability",
    label: "adaptability",
    type: "behavioral",
    skillSetIds: ["self-direction", "collaboration"],
    definition: "adjusting goals, methods, or expectations as conditions change without losing direction.",
  },
  {
    id: "initiative",
    label: "initiative",
    type: "behavioral",
    skillSetIds: ["self-direction", "creative-expression"],
    definition: "starting and sustaining action without waiting for instruction or permission.",
  },
  {
    id: "persistence",
    label: "persistence",
    type: "behavioral",
    skillSetIds: ["self-direction"],
    definition: "continuing through difficulty when the work is meaningful — and knowing when difficulty is signaling a different need.",
  },
  {
    id: "responsibility",
    label: "responsibility",
    type: "behavioral",
    skillSetIds: ["global-citizenship", "self-direction"],
    definition: "taking ownership of the consequences of your actions and the systems you participate in.",
  },
  {
    id: "curiosity",
    label: "curiosity",
    type: "behavioral",
    skillSetIds: ["creative-expression", "self-direction", "critical-thinking"],
    definition: "following a question past the easy answer, into the territory that surprises you.",
  },
];

// type colors are constrained by WCAG 1.4.3 (4.5:1 for normal text). brand
// --wv-sienna (#cb7858) + white = 3.33:1, which fails AA — so behavioral
// chips use the deeper sienna (#8a3b30) borrowed from the regen-catalogue
// palette, which hits 7.66:1 with white. cognitive (cadet) + champagne =
// 9.8:1 and social (redwood) + white = 4.7:1, both pass.
export const TYPE_META: Record<SkillType, { label: string; bg: string; text: string; description: string }> = {
  cognitive: {
    label: "cognitive",
    bg: "var(--wv-cadet)",
    text: "var(--wv-champagne)",
    description: "how we process, reason, and make sense.",
  },
  social: {
    label: "social",
    bg: "var(--wv-redwood)",
    text: "var(--wv-white)",
    description: "how we relate, communicate, and coordinate.",
  },
  behavioral: {
    label: "behavioral",
    bg: "#8a3b30",
    text: "var(--wv-white)",
    description: "how we act, regulate, and follow through.",
  },
};
