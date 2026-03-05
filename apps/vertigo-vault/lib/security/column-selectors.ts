/**
 * Column-selection helpers for vault tier-based access control.
 *
 * Every query that returns vault activity data to a client must use
 * one of these selectors so that paid/internal fields are never
 * fetched in the first place.
 *
 * Access tiers:
 *   teaser       — browsable catalog (name, headline, duration, etc.)
 *   entitled     — Explorer pack ($9.99): full body + materials
 *   practitioner — Practitioner pack ($19.99): + facilitator notes + video
 *   internal     — admin/collective: + sync metadata
 */

/** Teaser tier — browsable catalog, enough to entice but not enough to run. */
export const VAULT_TEASER_COLUMNS = [
  "id",
  "slug",
  "name",
  "headline",
  "headline_html",
  "duration",
  "format",
  "type",
  "skills_developed",
  "tags",
  "tier",
  "age_range",
  "group_size",
  "cover_url",
] as const;

/**
 * Entitled tier — user owns the Explorer pack ($9.99).
 * Adds the full activity body, content, and materials list.
 */
export const VAULT_ENTITLED_COLUMNS = [
  ...VAULT_TEASER_COLUMNS,
  "body_html",
  "content_md",
  "materials_needed",
] as const;

/**
 * Practitioner tier — user owns the Practitioner pack ($19.99).
 * Adds expert-level facilitator notes and video walkthroughs.
 */
export const VAULT_PRACTITIONER_COLUMNS = [
  ...VAULT_ENTITLED_COLUMNS,
  "facilitator_notes",
  "facilitator_notes_html",
  "video_url",
] as const;

/** Internal-only — admin dashboard. Includes sync metadata. */
export const VAULT_INTERNAL_COLUMNS = [
  ...VAULT_PRACTITIONER_COLUMNS,
  "notion_id",
  "notion_last_edited",
  "synced_at",
] as const;

// ── helper ──────────────────────────────────────────────────────────────

/** Safe SQL identifier pattern — lowercase letters, digits, underscores. */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Build a SQL column list string from a selector array.
 * E.g. `columnsToSql(VAULT_TEASER_COLUMNS)` → `"id, slug, name, …"`
 *
 * Validates every column name against a safe identifier regex as a
 * defense-in-depth measure. The column arrays above are compile-time
 * constants, but this guard protects against accidental misuse if
 * the function is ever called with dynamic input.
 */
export function columnsToSql(columns: readonly string[]): string {
  for (const col of columns) {
    if (!SAFE_IDENTIFIER.test(col)) {
      throw new Error(
        `[security] unsafe column identifier "${col}" — expected lowercase snake_case`,
      );
    }
  }
  return columns.join(", ");
}
