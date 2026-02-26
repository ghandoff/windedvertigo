/**
 * Column-selection helpers for the three-tier anti-leak model.
 *
 * Every query that returns playdate/material data to a client must use
 * one of these selectors so that internal-only fields are never fetched
 * in the first place.
 */

// ── playdates ────────────────────────────────────────────────────────────

/** Teaser tier — public sampler page, unauthenticated visitors. */
export const PLAYDATE_TEASER_COLUMNS = [
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
  "rails_sentence",
  "age_range",
] as const;

/** Entitled tier — authenticated users whose org owns the pack. */
export const PLAYDATE_ENTITLED_COLUMNS = [
  ...PLAYDATE_TEASER_COLUMNS,
  "slots_optional",
  "slots_notes",
  "find",
  "fold",
  "unfold",
  "find_again_mode",
  "find_again_prompt",
  "substitutions_notes",
] as const;

/** Collective tier — windedvertigo.com team. Entitled + design context. */
export const PLAYDATE_COLLECTIVE_COLUMNS = [
  ...PLAYDATE_ENTITLED_COLUMNS,
  "design_rationale",
  "developmental_notes",
  "author_notes",
] as const;

/** Internal-only — admin dashboard. Includes everything. */
export const PLAYDATE_INTERNAL_COLUMNS = [
  ...PLAYDATE_COLLECTIVE_COLUMNS,
  "ip_tier",
  "notion_id",
  "notion_last_edited",
  "synced_at",
] as const;

// ── materials ───────────────────────────────────────────────────────────

/** Teaser tier — only the basics shown alongside playdate teasers. */
export const MATERIAL_TEASER_COLUMNS = [
  "id",
  "title",
  "form_primary",
  "functions",
  "context_tags",
] as const;

/** Entitled tier — full material details for purchased playdates. */
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
 * E.g. `columnsToSql(PLAYDATE_TEASER_COLUMNS)` → `"id, slug, title, …"`
 */
export function columnsToSql(columns: readonly string[]): string {
  return columns.join(", ");
}
