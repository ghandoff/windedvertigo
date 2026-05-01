import type { AuthenticityProfile } from "./types";

export interface AuthenticityCriterion {
  key: keyof AuthenticityProfile;
  label: string;
  description: string;
  question: string;
}

/**
 * six authenticity criteria for formative assessment tasks
 * (Baquero-Vargas & Pérez-Salas, 2023)
 */
export const AUTHENTICITY_CRITERIA: AuthenticityCriterion[] = [
  {
    key: "realism",
    label: "realism",
    description: "the task mirrors how this knowledge or skill is used in professional or real-world contexts",
    question: "does the task reflect authentic professional practice or real-world application?",
  },
  {
    key: "complexity",
    label: "complexity",
    description: "the task requires integrating multiple concepts, skills, or knowledge types",
    question: "does the task demand integration across multiple knowledge areas?",
  },
  {
    key: "challenge",
    label: "challenge",
    description: "the task is pitched at the appropriate cognitive stretch for the stated Bloom's level",
    question: "is the cognitive demand calibrated to the learning objective — not too easy, not impossible?",
  },
  {
    key: "collaboration",
    label: "collaboration",
    description: "the task involves meaningful peer interaction, not just parallel work",
    question: "does the task structure require genuine interdependence between learners?",
  },
  {
    key: "reflection",
    label: "reflection",
    description: "the task prompts metacognitive awareness — thinking about one's own thinking and learning",
    question: "does the task invite students to monitor and evaluate their own cognitive process?",
  },
  {
    key: "diversity",
    label: "diversity",
    description: "the task accommodates multiple valid approaches, perspectives, or solution paths",
    question: "can students demonstrate competence through different legitimate strategies?",
  },
];

/** minimum average score to pass the quality gate */
export const AUTHENTICITY_THRESHOLD = 3.0;

/** minimum number of criteria that must score >= 3 */
export const AUTHENTICITY_MIN_PASSING = 4;

/** calculate whether a task passes the authenticity quality gate */
export function passes_authenticity_gate(scores: AuthenticityProfile): boolean {
  const values = Object.values(scores);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const passing_count = values.filter((v) => v >= AUTHENTICITY_THRESHOLD).length;
  return avg >= AUTHENTICITY_THRESHOLD && passing_count >= AUTHENTICITY_MIN_PASSING;
}

/** calculate aggregate authenticity score */
export function authenticity_score(scores: AuthenticityProfile): number {
  const values = Object.values(scores);
  return values.reduce((a, b) => a + b, 0) / values.length;
}
