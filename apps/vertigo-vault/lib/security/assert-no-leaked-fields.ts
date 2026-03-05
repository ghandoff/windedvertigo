/**
 * Security guard that scans response payloads for fields that should
 * never reach the client at a given vault tier.
 *
 * Usage:
 *   assertNoLeakedFields(rows, "vault_teaser");
 *
 * Behaviour by environment:
 *   development / test → throws Error (hard fail, catches leaks early)
 *   production         → console.error + returns false (never crashes the page)
 *
 * Previous versions were a no-op in production, which meant tier-violation
 * bugs could ship silently. Now production gets observability via logs
 * while dev/test still gets the fast-fail DX.
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

/**
 * Check whether any rows contain fields forbidden for the given tier.
 * Returns `true` if the payload is clean, `false` if a leak was detected.
 */
export function assertNoLeakedFields(
  rows: Record<string, unknown>[],
  tier: VaultTier,
): boolean {
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

  if (forbidden.size === 0) return true;

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (forbidden.has(key)) {
        const msg =
          `[security] leaked field "${key}" in ${tier}-tier response. ` +
          `Check your column selector.`;

        if (process.env.NODE_ENV === "production") {
          // Log but don't crash — observable in Vercel runtime logs
          console.error(msg);
          return false;
        }
        // Dev / test — hard fail for fast feedback
        throw new Error(msg);
      }
    }
  }

  return true;
}
