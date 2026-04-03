/**
 * @windedvertigo/mirror-log
 *
 * Metacognitive reflection toolkit for the harbour ecosystem.
 *
 * Usage in any harbour app:
 *
 *   import { ReflectionPrompt } from "@windedvertigo/mirror-log";
 *
 *   <ReflectionPrompt
 *     sourceApp="tidal-pool"
 *     skillsExercised={["systems-thinking", "cause-and-effect"]}
 *     onComplete={(r) => console.log("saved:", r)}
 *   />
 */

// Components
export { ReflectionPrompt } from "./components/reflection-prompt";
export { MoodPicker } from "./components/mood-picker";

// Lib
export { selectPrompt } from "./lib/prompts";
export {
  loadReflections,
  saveReflection,
  getReflectionsByApp,
  getReflectionsBySkill,
  getReflectionStreak,
} from "./lib/storage";

// Types
export type {
  Reflection,
  MoodType,
  ReflectionPromptConfig,
  PromptBank,
} from "./lib/types";

// Prompt bank (for customization)
export { DEFAULT_PROMPTS } from "./prompts/default-bank";
