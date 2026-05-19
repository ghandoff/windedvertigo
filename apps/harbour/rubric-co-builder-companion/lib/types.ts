// Companion-only types. Intentionally slimmed copies of the full
// rubric-co-builder types — no DB ids, no participant/host distinction,
// no facilitator-state machine. A draft is a single user's local rubric.

export type ScaleLevel = 1 | 2 | 3 | 4;

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

export type Pledge = {
  text: string;
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

export const ARTIFACT_EXAMPLES = [
  "presentation",
  "essay",
  "prototype",
  "portfolio",
  "case study",
  "code project",
  "research paper",
  "design mockup",
  "video",
];

export const SCALE_LEVELS: Array<{ level: ScaleLevel; label: string }> = [
  { level: 1, label: "novice" },
  { level: 2, label: "emerging" },
  { level: 3, label: "proficient" },
  { level: 4, label: "advanced" },
];

export const DEFAULT_DESCRIPTORS: Record<ScaleLevel, string> = {
  1: "the thing is missing or so thin it doesn't land. a reader couldn't tell what the team meant to do.",
  2: "it's there, but uneven. pieces are strong, pieces are thin, the overall effect wobbles.",
  3: "the criterion is clearly met. a reasonable reader would call this solid.",
  4: "the work raises the bar — the reader notices something they didn't expect to see.",
};

export const STEP_ORDER: DraftStep[] = ["frame", "seed", "scale", "pledge", "commit"];

export function emptyDraft(): Draft {
  return {
    learning_outcome: "",
    artefact: "",
    criteria: [],
    descriptors: [],
    pledge: { text: "" },
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
