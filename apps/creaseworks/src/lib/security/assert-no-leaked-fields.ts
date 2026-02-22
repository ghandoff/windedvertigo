/**
 * Development / staging guard that scans API response payloads for
 * fields that should never reach the client at a given tier.
 *
 * Usage (in API routes during dev):
 *   assertNoLeakedFields(rows, "teaser");
 *
 * In production this is a no-op so there is zero runtime cost.
 */

const INTERNAL_ONLY_FIELDS = new Set([
  "notion_id",
  "notion_last_edited",
  "synced_at",
  "ip_tier",
  "do_not_use",
  "do_not_use_reason",
]);

const ENTITLED_ONLY_FIELDS = new Set([
  "slots_optional",
  "slots_notes",
  "rails_sentence",
  "find",
  "fold",
  "unfold",
  "find_again_mode",
  "find_again_prompt",
  "substitutions_notes",
  "connector_modes",
  "shareability",
  "min_qty_size",
  "examples_notes",
  "generation_notes",
  "generation_prompts",
  "source",
]);

type Tier = "teaser" | "entitled" | "internal";

export function assertNoLeakedFields(
  rows: Record<string, unknown>[],
  tier: Tier,
): void {
  // only run in development / staging
  if (process.env.NODE_ENV === "production") return;

  const forbidden = new Set<string>();

  if (tier === "teaser") {
    INTERNAL_ONLY_FIELDS.forEach((f) => forbidden.add(f));
    ENTITLED_ONLY_FIELDS.forEach((f) => forbidden.add(f));
  } else if (tier === "entitled") {
    INTERNAL_ONLY_FIELDS.forEach((f) => forbidden.add(f));
  }
  // internal tier → nothing is forbidden

  if (forbidden.size === 0) return;

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (forbidden.has(key)) {
        throw new Error(
          `[security] leaked field "${key}" in ${tier}-tier response. ` +
            `Check your column selector.`,
        );
      }
    }
  }
}
