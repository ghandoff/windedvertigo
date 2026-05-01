/**
 * @windedvertigo/mirror-log — types
 */

export interface Reflection {
  id: string;
  timestamp: string;
  sourceApp: string;
  prompt: string;
  response: string;
  skillSlugs: string[];
  mood: MoodType | null;
}

export type MoodType =
  | "energized"
  | "curious"
  | "frustrated"
  | "calm"
  | "uncertain";

export interface ReflectionPromptConfig {
  /** Which harbour app is embedding this prompt. */
  sourceApp: string;
  /** depth.chart skill slugs relevant to the activity just completed. */
  skillsExercised: string[];
  /** Brief summary of what the learner just did. */
  sessionSummary?: string;
}

export interface PromptBank {
  /** Generic prompts that work in any context. */
  generic: string[];
  /** Prompts keyed by skill slug for targeted reflection. */
  bySkill: Record<string, string[]>;
  /** Prompts keyed by source app for context-specific reflection. */
  byApp: Record<string, string[]>;
}
