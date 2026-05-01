/**
 * Seasonal utility functions
 *
 * Provides utilities for determining the current season and associated
 * campaign tags for seasonal recommendations.
 *
 * Display text (labels, emojis, descriptions) can be managed via the
 * "seasonal" group in the app config Notion database. Hard-coded
 * fallbacks are used when CMS data is unavailable.
 */

import { getConfigGroup, parseMetadata } from "@/lib/queries/app-config";

export type Season = "spring" | "summer" | "fall" | "winter";

interface SeasonTheme {
  season: Season;
  emoji: string;
  label: string;
  color: string;
  description: string;
  tags: string[];
}

const FALLBACK_THEMES: Record<Season, SeasonTheme> = {
  spring: {
    season: "spring",
    emoji: "🌱",
    label: "spring playdates",
    color: "text-green-600",
    description: "outdoor adventures and nature exploration for warmer days",
    tags: ["spring", "outdoor", "garden", "rainy-day", "planting"],
  },
  summer: {
    season: "summer",
    emoji: "☀️",
    label: "summer playdates",
    color: "text-yellow-500",
    description: "sunny, active, and water-filled fun for hot days",
    tags: ["summer", "outdoor", "water", "beach", "heat"],
  },
  fall: {
    season: "fall",
    emoji: "🍂",
    label: "fall playdates",
    color: "text-orange-600",
    description: "harvest, spooky, and cozy activities as days get cooler",
    tags: ["fall", "autumn", "harvest", "halloween", "leaves"],
  },
  winter: {
    season: "winter",
    emoji: "❄️",
    label: "winter playdates",
    color: "text-cadet",
    description: "cozy indoor activities and festive fun for chilly days",
    tags: ["winter", "holiday", "indoor", "cozy", "snow"],
  },
};

/**
 * Get the current season based on the current month.
 */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1;

  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

/**
 * Get seasonal campaign tags. Falls back to hard-coded defaults.
 * This is async because it checks the CMS first.
 */
export async function getSeasonalTags(): Promise<string[]> {
  const theme = await getSeasonalTheme();
  return theme.tags;
}

/**
 * Get display information for the current season theme.
 * Pulls from the app config CMS when available, with hard-coded fallbacks.
 */
export async function getSeasonalTheme(): Promise<SeasonTheme> {
  const season = getCurrentSeason();

  try {
    const items = await getConfigGroup("seasonal");
    const match = items.find((i) => {
      const m = parseMetadata<{ value: string }>(i);
      return m.value === season;
    });

    if (match) {
      const m = parseMetadata<{
        value: string;
        emoji: string;
        color: string;
        description: string;
        tags: string[];
      }>(match);
      return {
        season,
        emoji: m.emoji,
        label: match.name,
        color: m.color,
        description: m.description,
        tags: m.tags ?? FALLBACK_THEMES[season].tags,
      };
    }
  } catch {
    // CMS unavailable — use fallback
  }

  return FALLBACK_THEMES[season];
}
