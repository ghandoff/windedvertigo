/**
 * Shared UI constants for vault activity rendering.
 * Centralised here so card and detail pages stay in sync.
 */

/** Accent colours keyed by vault activity type. */
export const TYPE_COLORS: Record<string, string> = {
  Energizer: "#AF4F41",
  "Getting to know each other": "#6b8e6b",
  "Playful reflections": "#8b6fb0",
  "RME Related": "#4a7fb5",
};

/** Resolve the accent colour for an activity's primary type. */
export function typeColor(type: string | undefined): string {
  return TYPE_COLORS[type ?? ""] ?? "#6b7b8d";
}
