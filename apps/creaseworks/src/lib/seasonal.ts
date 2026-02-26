/**
 * Seasonal utility functions
 *
 * Provides utilities for determining the current season and associated
 * campaign tags for seasonal recommendations.
 */

export type Season = "spring" | "summer" | "fall" | "winter";

/**
 * Get the current season based on the current month.
 * Spring: Mar-May (3-5)
 * Summer: Jun-Aug (6-8)
 * Fall: Sep-Nov (9-11)
 * Winter: Dec-Feb (12, 1-2)
 */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1-12

  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

/**
 * Get seasonal campaign tags based on the current season.
 * These tags are used to match playdates with campaign_tags in the database.
 */
export function getSeasonalTags(): string[] {
  const season = getCurrentSeason();

  const tagMap: Record<Season, string[]> = {
    spring: ["spring", "outdoor", "garden", "rainy-day", "planting"],
    summer: ["summer", "outdoor", "water", "beach", "heat"],
    fall: ["fall", "autumn", "harvest", "halloween", "leaves"],
    winter: ["winter", "holiday", "indoor", "cozy", "snow"],
  };

  return tagMap[season];
}

/**
 * Get display information for the current season theme.
 */
export function getSeasonalTheme() {
  const season = getCurrentSeason();

  const themeMap: Record<
    Season,
    {
      season: Season;
      emoji: string;
      label: string;
      color: string;
      description: string;
    }
  > = {
    spring: {
      season: "spring",
      emoji: "🌱",
      label: "Spring Playdates",
      color: "text-green-600",
      description: "outdoor adventures and nature exploration for warmer days",
    },
    summer: {
      season: "summer",
      emoji: "☀️",
      label: "Summer Playdates",
      color: "text-yellow-500",
      description: "sunny, active, and water-filled fun for hot days",
    },
    fall: {
      season: "fall",
      emoji: "🍂",
      label: "Fall Playdates",
      color: "text-orange-600",
      description: "harvest, spooky, and cozy activities as days get cooler",
    },
    winter: {
      season: "winter",
      emoji: "❄️",
      label: "Winter Playdates",
      color: "text-blue-600",
      description: "cozy indoor activities and festive fun for chilly days",
    },
  };

  return themeMap[season];
}
