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

const COLLECTIVE_ONLY_FIELDS = new Set([
  "design_rationale",
  "developmental_notes",
  "author_notes",
]);

const ENTITLED_ONLY_FIELDS = new Set([
  "slots_optional",
  "slots_notes",
  // rails_sentence is intentionally in PLAYDATE_TEASER_COLUMNS (public)
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

// ── vault-specific tier fields ─────────────────────────────────────────

/** Vault fields that require at least the Explorer pack. */
const VAULT_ENTITLED_ONLY_FIELDS = new Set([
  "body_html",
  "content_md",
  "materials_needed",
]);

/** Vault fields that require the Practitioner pack. */
const VAULT_PRACTITIONER_ONLY_FIELDS = new Set([
  "facilitator_notes",
  "facilitator_notes_html",
  "video_url",
]);

type Tier = "teaser" | "entitled" | "collective" | "internal";
type VaultTier = "vault_teaser" | "vault_entitled" | "vault_practitioner" | "vault_internal";

export function assertNoLeakedFields(
  rows: Record<string, unknown>[],
  tier: Tier | VaultTier,
): void {
  // only run in development / staging
  if (process.env.NODE_ENV === "production") return;

  const forbidden = new Set<string>();

  // ── playdate / material tiers ──
  if (tier === "teaser") {
    INTERNAL_ONLY_FIELDS.forEach((f) => forbidden.add(f));
    COLLECTIVE_ONLY_FIELDS.forEach((f) => forbidden.add(f));
    ENTITLED_ONLY_FIELDS.forEach((f) => forbidden.add(f));
  } else if (tier === "entitled") {
    INTERNAL_ONLY_FIELDS.forEach((f) => forbidden.add(f));
    COLLECTIVE_ONLY_FIELDS.forEach((f) => forbidden.add(f));
  } else if (tier === "collective") {
    INTERNAL_ONLY_FIELDS.forEach((f) => forbidden.add(f));
  }

  // ── vault tiers ──
  if (tier === "vault_teaser") {
    INTERNAL_ONLY_FIELDS.forEach((f) => forbidden.add(f));
    VAULT_ENTITLED_ONLY_FIELDS.forEach((f) => forbidden.add(f));
    VAULT_PRACTITIONER_ONLY_FIELDS.forEach((f) => forbidden.add(f));
  } else if (tier === "vault_entitled") {
    INTERNAL_ONLY_FIELDS.forEach((f) => forbidden.add(f));
    VAULT_PRACTITIONER_ONLY_FIELDS.forEach((f) => forbidden.add(f));
  } else if (tier === "vault_practitioner") {
    INTERNAL_ONLY_FIELDS.forEach((f) => forbidden.add(f));
  }
  // internal / vault_internal → nothing is forbidden

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
