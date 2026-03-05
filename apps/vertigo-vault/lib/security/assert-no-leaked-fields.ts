/**
 * Development / staging guard that scans API response payloads for
 * fields that should never reach the client at a given vault tier.
 *
 * Usage (in API routes during dev):
 *   assertNoLeakedFields(rows, "vault_teaser");
 *
 * In production this is a no-op so there is zero runtime cost.
 */

const INTERNAL_ONLY_FIELDS = new Set([
  "notion_id",
  "notion_last_edited",
  "synced_at",
]);

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

type VaultTier = "vault_teaser" | "vault_entitled" | "vault_practitioner" | "vault_internal";

export function assertNoLeakedFields(
  rows: Record<string, unknown>[],
  tier: VaultTier,
): void {
  // only run in development / staging
  if (process.env.NODE_ENV === "production") return;

  const forbidden = new Set<string>();

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
  // vault_internal → nothing is forbidden

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
