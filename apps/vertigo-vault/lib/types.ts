/** A single activity from the Vertigo Vault Notion database. */
export interface VaultActivity {
  id: string;
  name: string;
  headline: string | null;
  duration: string | null;
  format: string[];
  type: string[];
  skillsDeveloped: string[];
  coverImage: string | null;
  content: string; // markdown
}

/** Accent colours keyed by activity type. */
export const TYPE_COLORS: Record<string, { bar: string; cls: string }> = {
  Energizer: { bar: "#AF4F41", cls: "type-energizer" },
  "Getting to know each other": { bar: "#6b8e6b", cls: "type-getting-to-know" },
  "Playful reflections": { bar: "#8b6fb0", cls: "type-playful-reflections" },
  "RME Related": { bar: "#4a7fb5", cls: "type-rme-related" },
};

/** Return the accent colour for a given type, falling back to a neutral. */
export function typeColor(type: string | undefined): string {
  return TYPE_COLORS[type ?? ""]?.bar ?? "#6b7b8d";
}
