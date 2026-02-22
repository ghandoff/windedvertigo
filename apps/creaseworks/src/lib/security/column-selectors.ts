/**
 * Column-selection helpers for the three-tier anti-leak model.
 *
 * Every query that returns pattern/material data to a client must use
 * one of these selectors so that internal-only fields are never fetched
 * in the first place.
 */

// ── patterns ────────────────────────────────────────────────────────────

/** Teaser tier — public sampler page, unauthenticated visitors. */
export const PATTERN_TEASER_COLUMNS = [
  "id",
  "slug",
  "title",
  "headline",
  "release_channel",
  "status",
  "primary_function",
  "arc_emphasis",
  "context_tags",
  "friction_dial",
  "start_in_120s",
  "required_forms",
] as const;

/** Entitled tier — authenticated users whose org owns the pack. */
export const PATTERN_ENTITLED_COLUMNS = [
  ...PATTERN_TEASER_COLUMNS,
  "slots_optional",
  "slots_notes",
  "rails_sentence",
  "find",
  "fold",
  "unfold",
  "find_again_mode",
  "find_again_prompt",
  "substitutions_notes",
] as const;

/** Internal-only — admin dashboard. Includes everything. */
export const PATTERN_INTERNAL_COLUMNS = [
  ...PATTERN_ENTITLED_COLUMNS,
  "ip_tier",
  "notion_id",
  "notion_last_edited",
  "synced_at",
] as const;

// ── materials ───────────────────────────────────────────────────────────

/** Teaser tier — only the basics shown alongside pattern teasers. */
export const MATERIAL_TEASER_COLUMNS = [
  "id",
  "title",
  "form_primary",
  "functions",
  "context_tags",
] as const;

/** Entitled tier — full material details for purchased patterns. */
export const MATERIAL_ENTITLED_COLUMNS = [
  ...MATERIAL_TEASER_COLUMNS,
  "connector_modes",
  "shareability",
  "min_qty_size",
  "examples_notes",
  "generation_notes",
  "generation_prompts",
  "source",
] as const;

/** Internal-only — admin dashboard. */
export const MATERIAL_INTERNAL_COLUMNS = [
  ...MATERIAL_ENTITLED_COLUMNS,
  "do_not_use",
  "do_not_use_reason",
  "notion_id",
  "notion_last_edited",
  "synced_at",
] as const;

// ── helper ──────────────────────────────────────────────────────────────

/**
 * Build a SQL column list string from a selector array.
 * E.g. `columnsToSql(PATTERN_TEASER_COLUMNS)` → `"id, slug, title, …"`
 */
export function columnsToSql(columns: readonly string[]): string {
  return columns.join(", ");
}
