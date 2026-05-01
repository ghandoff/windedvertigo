/**
 * Material mastery badges — computed from usage history.
 *
 * Pure logic on top of getUserMaterialMastery() — no new database
 * queries needed. Each badge tracks progress toward a threshold.
 */

import { getUserMaterialMastery } from "./material-mastery";

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  progress?: { current: number; target: number };
}

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  compute: (mastery: Awaited<ReturnType<typeof getUserMaterialMastery>>) => number;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "explorer",
    title: "explorer",
    description: "used 5 different materials across any playdates",
    icon: "🧭",
    target: 5,
    compute: (mastery) => mastery.length,
  },
  {
    id: "connector-specialist",
    title: "connector specialist",
    description: "used 3+ different materials as connectors",
    icon: "🔗",
    target: 3,
    compute: (mastery) =>
      mastery.filter((m) =>
        m.functionsUsed.some((fn) => fn.toLowerCase().includes("connector")),
      ).length,
  },
  {
    id: "function-finder",
    title: "function finder",
    description: "used the same material in 3+ different functions",
    icon: "🔍",
    target: 3,
    compute: (mastery) =>
      Math.max(0, ...mastery.map((m) => m.functionsUsed.length)),
  },
  {
    id: "material-master",
    title: "material master",
    description: "used a single material in 5+ playdates",
    icon: "⭐",
    target: 5,
    compute: (mastery) =>
      Math.max(0, ...mastery.map((m) => m.totalRuns)),
  },
  {
    id: "creative-recycler",
    title: "creative recycler",
    description: "used 10+ different materials total",
    icon: "♻️",
    target: 10,
    compute: (mastery) => mastery.length,
  },
  {
    id: "versatile-maker",
    title: "versatile maker",
    description: "used materials across 4+ different functions",
    icon: "🎨",
    target: 4,
    compute: (mastery) => {
      const allFunctions = new Set<string>();
      for (const m of mastery) {
        for (const fn of m.functionsUsed) {
          allFunctions.add(fn.toLowerCase());
        }
      }
      return allFunctions.size;
    },
  },
];

/**
 * Compute earned badges from a user's material mastery data.
 */
export async function getUserBadges(userId: string): Promise<Badge[]> {
  const mastery = await getUserMaterialMastery(userId);

  return BADGE_DEFINITIONS.map((def) => {
    const current = def.compute(mastery);
    const earned = current >= def.target;
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      earned,
      progress: earned ? undefined : { current, target: def.target },
    };
  });
}
