/**
 * Vibe configurations for Scavenger Hunt mode.
 *
 * Each vibe is a provocation — it sets the tone for *how* to look,
 * not just *where*. The kid picks a feeling, and the system finds
 * playdates that match that energy.
 *
 * Vibes map directly to existing context_tags and energyLevel values
 * in the playdates database. If a vibe references a context that
 * doesn't exist in the DB, filterVibesForAvailableContexts strips it.
 */

import { VibeConfig } from "./types";

export const VIBES: VibeConfig[] = [
  {
    key: "messy",
    label: "let's get messy!",
    emoji: "🎨",
    contexts: ["messy"],
    energyLevels: ["active"],
    color: "var(--wv-redwood)",
    description: "paint, glue, squish — anything goes!",
  },
  {
    key: "quiet",
    label: "something calm",
    emoji: "🤫",
    contexts: ["quiet"],
    energyLevels: ["calm"],
    color: "var(--wv-champagne)",
    description: "peaceful making, no mess required",
  },
  {
    key: "outside",
    label: "let's go outside!",
    emoji: "🌳",
    contexts: ["outdoors"],
    energyLevels: [],
    color: "#434824",   // complementary green
    description: "nature stuff, sunshine, fresh air",
  },
  {
    key: "kitchen",
    label: "kitchen time",
    emoji: "🍳",
    contexts: ["kitchen"],
    energyLevels: [],
    color: "var(--wv-sienna)",
    description: "use stuff from the kitchen",
  },
  {
    key: "quick",
    label: "fast and fun",
    emoji: "⚡",
    contexts: [],
    energyLevels: ["moderate"],
    color: "#5872cb",   // complementary blue
    description: "start in 2 minutes, done quickly",
  },
  {
    key: "big-build",
    label: "big build!",
    emoji: "🏗️",
    contexts: ["indoors"],
    energyLevels: ["active"],
    color: "var(--wv-cadet)",
    description: "go big — towers, bridges, machines",
  },
];

/**
 * Filter vibes to only those whose context tags exist in the live DB.
 * Prevents zero-result queries if a context is removed from Notion.
 */
export function filterVibesForAvailableContexts(
  vibes: VibeConfig[],
  availableContexts: string[],
): VibeConfig[] {
  const ctxSet = new Set(availableContexts.map((c) => c.toLowerCase()));

  return vibes.map((vibe) => ({
    ...vibe,
    // strip unknown contexts — keep the vibe but with fewer constraints
    contexts: vibe.contexts.filter((c) => ctxSet.has(c.toLowerCase())),
  })).filter(
    // only keep vibes that still have at least one filter
    (v) => v.contexts.length > 0 || v.energyLevels.length > 0,
  );
}
