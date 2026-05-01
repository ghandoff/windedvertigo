/**
 * @windedvertigo/mirror-log — prompt selection
 *
 * Picks contextually relevant prompts based on the source app
 * and skills exercised. Falls back to generic prompts.
 */

import type { PromptBank, ReflectionPromptConfig } from "./types";
import { DEFAULT_PROMPTS } from "../prompts/default-bank";

/**
 * Select a prompt for the given context.
 * Prefers skill-specific > app-specific > generic.
 */
export function selectPrompt(
  config: ReflectionPromptConfig,
  bank: PromptBank = DEFAULT_PROMPTS,
): string {
  const candidates: string[] = [];

  // Skill-specific prompts
  for (const slug of config.skillsExercised) {
    const skillPrompts = bank.bySkill[slug];
    if (skillPrompts) candidates.push(...skillPrompts);
  }

  // App-specific prompts
  const appPrompts = bank.byApp[config.sourceApp];
  if (appPrompts) candidates.push(...appPrompts);

  // Generic fallback
  if (candidates.length === 0) {
    candidates.push(...bank.generic);
  }

  // Pick one at random
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] ?? bank.generic[0] ?? "what did you notice?";
}
