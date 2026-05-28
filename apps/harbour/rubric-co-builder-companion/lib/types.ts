// Companion-only types. Intentionally slimmed copies of the full
// rubric-co-builder types — no DB ids, no participant/host distinction,
// no facilitator-state machine. A draft is a single user's local rubric.

export type ScaleLevel = 1 | 2 | 3 | 4;

// AI use ladder rungs (mirrored from the full app's AI_USE_LEVELS so the
// freemium-to-paid handoff has the same vocabulary).
export type AiUseLevel = 0 | 1 | 2 | 3 | 4;

export type Criterion = {
  id: string; // client-side uuid, never sent to a server
  name: string;
  good_description: string; // what "good" looks like for this criterion
  required: boolean; // tagged as a non-negotiable bar
};

export type Descriptor = {
  criterion_id: string;
  level: ScaleLevel;
  text: string;
};

// Pledge restructured 2026-05-20 for the PRME launch: a rung on the AI
// ladder + four prompt completions ("we will use AI for…", etc.). The
// old single-text Pledge.text shape is dead; sessionStorage versioning
// in lib/storage.ts bumps the key so any pre-PRME drafts get cleared
// rather than silently mis-rendered.
export type Pledge = {
  ai_level: AiUseLevel | null;
  will_use_for: string;
  will_not_use_for: string;
  will_disclose: string;
  if_cross_line: string;
};

export type DraftStep = "frame" | "seed" | "scale" | "pledge" | "commit";

export type Draft = {
  learning_outcome: string;
  artefact: string;
  criteria: Criterion[];
  descriptors: Descriptor[]; // 1 per criterion × level
  pledge: Pledge;
  step: DraftStep;
  updated_at: string;
};

export const SEED_CRITERIA: Array<Pick<Criterion, "name" | "good_description">> = [
  {
    name: "clarity",
    good_description: "the reader understands the point without needing to ask.",
  },
  {
    name: "collaboration",
    good_description: "every voice on the team left a fingerprint on the work.",
  },
  {
    name: "evidence",
    good_description: "claims are backed by sources the reader can check.",
  },
  {
    name: "execution",
    good_description: "the thing works, end to end, on the day it is due.",
  },
];

// The six PRME course contexts (replaces the old generic ARTIFACT_EXAMPLES
// dropdown). Each is a concrete teaching scenario PRME faculty actually
// run. Selecting a context fills the artefact field with the "artifact"
// sentence; the learning_outcome field stays open text so faculty can
// adapt the theme to their module's own outcome wording.
export type CourseContext = {
  id: string;
  number: number; // for "CONTEXT 1" through "CONTEXT 6" labels
  title: string;
  level: string; // "UG year 1", "MBA", etc.
  theme: string; // a one-line learning theme; offered as a hint, not auto-filled
  artefact: string; // detailed sentence describing the assessed artefact
};

export const COURSE_CONTEXTS: CourseContext[] = [
  {
    id: "intro-responsible-business",
    number: 1,
    title: "Introduction to responsible business",
    level: "UG year 1",
    theme: "Values, stakeholders, and the firm.",
    artefact:
      "a 60-minute assessed discussion in which students present a stakeholder analysis of a company of their choice.",
  },
  {
    id: "corporate-sustainability-strategy",
    number: 2,
    title: "Corporate sustainability strategy",
    level: "MBA",
    theme: "Materiality assessment.",
    artefact:
      "a 2,500-word individual report assessing a company's sustainability strategy against a materiality matrix.",
  },
  {
    id: "business-ethics-society",
    number: 3,
    title: "Business ethics and society",
    level: "UG year 2",
    theme: "Ethical decision making.",
    artefact:
      "a 1,500-word memo advising a board on an ethical dilemma.",
  },
  {
    id: "research-methods-management",
    number: 4,
    title: "Research methods for management",
    level: "postgraduate",
    theme: "Research design proposal.",
    artefact:
      "a 3,000-word proposal for an original research project. Current rubric has four rows; students have never contributed to rubric design.",
  },
  {
    id: "strategic-management",
    number: 5,
    title: "Strategic management",
    level: "UG year 3",
    theme: "Live case presentation.",
    artefact:
      "a 20-minute group presentation on a real company's strategic challenge.",
  },
  {
    id: "organisational-learning-development",
    number: 6,
    title: "Organisational learning & development",
    level: "MBA elective",
    theme: "Reflective practice portfolio.",
    artefact:
      "a portfolio of six reflective entries produced across the module.",
  },
];

// AI ladder rungs — mirrored from the full app's AI_USE_LEVELS (full
// rubric-co-builder/lib/types.ts). Kept in sync verbatim so a teacher
// who graduates from companion → full app keeps the same vocabulary.
export const AI_USE_LEVELS: Array<{
  level: AiUseLevel;
  name: string;
  helper: string;
}> = [
  {
    level: 0,
    name: "no AI anywhere.",
    helper:
      "nothing in this project touches an AI tool. research, drafting, feedback, polishing, all human.",
  },
  {
    level: 1,
    name: "AI for brainstorming only.",
    helper:
      "we can use AI to explore ideas at the start. every word in the final artefact is ours.",
  },
  {
    level: 2,
    name: "AI for feedback on drafts.",
    helper:
      "we draft, then use AI to test for clarity or gaps. we rewrite based on what we learn. the AI doesn't hold the pen.",
  },
  {
    level: 3,
    name: "AI co-authors our work, disclosed.",
    helper:
      "AI contributes to the drafting itself. we disclose where and how in the artefact.",
  },
  {
    level: 4,
    name: "AI is the subject we're studying.",
    helper:
      "the project is about AI. using AI tools is part of the inquiry. we document what we used and what we found.",
  },
];

export const SCALE_LEVELS: Array<{ level: ScaleLevel; label: string }> = [
  { level: 1, label: "exploring" },
  { level: 2, label: "emerging" },
  { level: 3, label: "proficient" },
  { level: 4, label: "advanced" },
];

export const DEFAULT_DESCRIPTORS: Record<ScaleLevel, string> = {
  1: "the thing is missing or so thin it doesn't land. a reader couldn't tell what the team meant to do.",
  2: "it's there, but uneven. pieces are strong, pieces are thin, the overall effect wobbles.",
  3: "the criterion is clearly met. a reasonable reader would call this solid.",
  4: "the work raises the bar. the reader notices something they didn't expect to see.",
};

export const STEP_ORDER: DraftStep[] = ["frame", "seed", "scale", "pledge", "commit"];

export function emptyPledge(): Pledge {
  return {
    ai_level: null,
    will_use_for: "",
    will_not_use_for: "",
    will_disclose: "",
    if_cross_line: "",
  };
}

export function emptyDraft(): Draft {
  return {
    learning_outcome: "",
    artefact: "",
    criteria: [],
    descriptors: [],
    pledge: emptyPledge(),
    step: "frame",
    updated_at: new Date().toISOString(),
  };
}

export function seedCriterion(
  name: string,
  good_description: string,
  required = false,
): Criterion {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Math.random().toString(36).slice(2, 10)}`,
    name,
    good_description,
    required,
  };
}
