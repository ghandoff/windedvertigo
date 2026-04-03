/**
 * tidal.pool — default palette elements
 *
 * Built-in elements available in sandbox mode.
 * Scenario mode may add or restrict elements via Notion.
 */

import type { PaletteItem } from "./types";

export const DEFAULT_PALETTE: PaletteItem[] = [
  // Natural
  {
    slug: "rainfall",
    label: "rainfall",
    icon: "🌧️",
    category: "natural",
    defaultValue: 50,
    color: "#3B82F6",
    description: "water entering the system",
  },
  {
    slug: "sunlight",
    label: "sunlight",
    icon: "☀️",
    category: "natural",
    defaultValue: 60,
    color: "#F59E0B",
    description: "energy from the sun",
  },
  {
    slug: "soil-health",
    label: "soil health",
    icon: "🌱",
    category: "natural",
    defaultValue: 50,
    color: "#84CC16",
    description: "the quality and fertility of the ground",
  },
  {
    slug: "biodiversity",
    label: "biodiversity",
    icon: "🦋",
    category: "natural",
    defaultValue: 50,
    color: "#14B8A6",
    description: "variety of living things in the system",
  },

  // Environmental
  {
    slug: "pollution",
    label: "pollution",
    icon: "🏭",
    category: "environmental",
    defaultValue: 20,
    color: "#6B7280",
    description: "harmful substances in the environment",
  },
  {
    slug: "temperature",
    label: "temperature",
    icon: "🌡️",
    category: "environmental",
    defaultValue: 50,
    color: "#EF4444",
    description: "how hot or cold the system is",
  },
  {
    slug: "water-quality",
    label: "water quality",
    icon: "💧",
    category: "environmental",
    defaultValue: 60,
    color: "#06B6D4",
    description: "cleanliness and usability of water",
  },

  // Economic
  {
    slug: "crop-yield",
    label: "crop yield",
    icon: "🌾",
    category: "economic",
    defaultValue: 40,
    color: "#22C55E",
    description: "how much food the land produces",
  },
  {
    slug: "market-price",
    label: "market price",
    icon: "💰",
    category: "economic",
    defaultValue: 50,
    color: "#A855F7",
    description: "what people are willing to pay",
  },
  {
    slug: "investment",
    label: "investment",
    icon: "📈",
    category: "economic",
    defaultValue: 30,
    color: "#EC4899",
    description: "resources put toward future growth",
  },

  // Social
  {
    slug: "population",
    label: "population",
    icon: "👥",
    category: "social",
    defaultValue: 50,
    color: "#F97316",
    description: "how many people are in the system",
  },
  {
    slug: "education",
    label: "education",
    icon: "📚",
    category: "social",
    defaultValue: 40,
    color: "#8B5CF6",
    description: "knowledge and skills of the community",
  },
  {
    slug: "wellbeing",
    label: "wellbeing",
    icon: "❤️",
    category: "social",
    defaultValue: 50,
    color: "#F43F5E",
    description: "health and happiness of the community",
  },
  {
    slug: "cooperation",
    label: "cooperation",
    icon: "🤝",
    category: "social",
    defaultValue: 50,
    color: "#0EA5E9",
    description: "how well people work together",
  },
];
