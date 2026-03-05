/**
 * Vault activity queries with tier-based column selection.
 *
 * Access tiers:
 *   teaser       — browsable catalog (name, headline, duration, etc.)
 *   entitled     — Explorer pack ($9.99): full body + materials
 *   practitioner — Practitioner pack ($19.99): + facilitator notes + video
 *   internal     — admin/collective: + sync metadata
 */

import { sql } from "@/lib/db";
import {
  columnsToSql,
  VAULT_TEASER_COLUMNS,
  VAULT_ENTITLED_COLUMNS,
  VAULT_PRACTITIONER_COLUMNS,
  VAULT_INTERNAL_COLUMNS,
} from "@/lib/security/column-selectors";
import { checkEntitlement } from "./entitlements";

export type VaultAccessTier = "teaser" | "entitled" | "practitioner" | "internal";

/**
 * Well-known vault pack slugs. These must match the slugs created in
 * the packs Notion database and synced to packs_cache.
 */
const VAULT_PACK_SLUGS = {
  explorer: "vault-explorer",
  practitioner: "vault-practitioner",
} as const;

/**
 * Resolve the highest vault access tier for a user.
 *
 * Checks entitlements against the two vault packs (practitioner first,
 * since it supersedes explorer). Falls back to teaser if neither is owned.
 * Internal users (admin / windedvertigo.com team) always get full access.
 */
export async function resolveVaultTier(
  orgId: string | null,
  userId: string | null,
  isInternal: boolean,
): Promise<VaultAccessTier> {
  if (isInternal) return "internal";
  if (!orgId && !userId) return "teaser";

  // Look up vault pack IDs from packs_cache
  const packs = await sql`
    SELECT id, slug FROM packs_cache
    WHERE slug IN (${VAULT_PACK_SLUGS.explorer}, ${VAULT_PACK_SLUGS.practitioner})
  `;
  const packMap = new Map(packs.rows.map((r: any) => [r.slug as string, r.id as string]));

  // Check practitioner first (supersedes explorer)
  const practitionerPackId = packMap.get(VAULT_PACK_SLUGS.practitioner);
  if (practitionerPackId) {
    const hasPractitioner = await checkEntitlement(orgId, practitionerPackId, userId);
    if (hasPractitioner) return "practitioner";
  }

  // Check explorer
  const explorerPackId = packMap.get(VAULT_PACK_SLUGS.explorer);
  if (explorerPackId) {
    const hasExplorer = await checkEntitlement(orgId, explorerPackId, userId);
    if (hasExplorer) return "entitled";
  }

  return "teaser";
}

function columnsForTier(tier: VaultAccessTier): string {
  switch (tier) {
    case "teaser":
      return columnsToSql(VAULT_TEASER_COLUMNS);
    case "entitled":
      return columnsToSql(VAULT_ENTITLED_COLUMNS);
    case "practitioner":
      return columnsToSql(VAULT_PRACTITIONER_COLUMNS);
    case "internal":
      return columnsToSql(VAULT_INTERNAL_COLUMNS);
  }
}

/**
 * Resolve which content tiers a given access tier can see.
 *
 * Tier hierarchy (cumulative):
 *   teaser       → only "prme" activities
 *   entitled     → "prme" + "explorer"
 *   practitioner → "prme" + "explorer" + "practitioner"
 *   internal     → everything (no filter)
 */
function visibleContentTiers(tier: VaultAccessTier): string[] | null {
  switch (tier) {
    case "teaser":
      return ["prme"];
    case "entitled":
      return ["prme", "explorer"];
    case "practitioner":
    case "internal":
      return null; // no row filter — show all
  }
}

/**
 * List vault activities filtered by both:
 *   1. Column selection (tier-based field visibility)
 *   2. Row filtering (only show activities the user's tier unlocks)
 *
 * Free users see only the 22 PRME activities.
 * Explorer users see PRME + Explorer (47).
 * Practitioner/internal users see all (72).
 */
export async function getVaultActivities(tier: VaultAccessTier) {
  const cols = columnsForTier(tier);
  const allowed = visibleContentTiers(tier);

  if (!allowed) {
    // practitioner / internal → all rows
    const result = await sql.query(
      `SELECT ${cols} FROM vault_activities_cache ORDER BY name ASC`,
    );
    return result.rows;
  }

  // Build parameterised IN clause for allowed content tiers
  const placeholders = allowed.map((_, i) => `$${i + 1}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols} FROM vault_activities_cache
     WHERE tier IN (${placeholders})
     ORDER BY name ASC`,
    allowed,
  );
  return result.rows;
}

/**
 * List vault activities filtered by content tier.
 * E.g. "show only PRME activities" or "show only explorer activities".
 * Enforces row-level access — requesting a content tier above the user's
 * access tier returns an empty array.
 */
export async function getVaultActivitiesByTier(
  accessTier: VaultAccessTier,
  contentTier: string,
) {
  // Enforce row-level access: don't return activities the user can't see
  const allowed = visibleContentTiers(accessTier);
  if (allowed && !allowed.includes(contentTier)) {
    return [];
  }

  const cols = columnsForTier(accessTier);
  const result = await sql.query(
    `SELECT ${cols} FROM vault_activities_cache
     WHERE tier = $1
     ORDER BY name ASC`,
    [contentTier],
  );
  return result.rows;
}

/**
 * Get a single vault activity by slug.
 * Enforces row-level access: free users can only view PRME activities.
 * Returns null if the activity exists but the user's tier doesn't unlock it.
 */
export async function getVaultActivityBySlug(
  slug: string,
  tier: VaultAccessTier,
) {
  const cols = columnsForTier(tier);
  const allowed = visibleContentTiers(tier);

  if (!allowed) {
    // practitioner / internal → no row filter
    const result = await sql.query(
      `SELECT ${cols} FROM vault_activities_cache WHERE slug = $1`,
      [slug],
    );
    return result.rows[0] ?? null;
  }

  const placeholders = allowed.map((_, i) => `$${i + 2}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols} FROM vault_activities_cache
     WHERE slug = $1 AND tier IN (${placeholders})`,
    [slug, ...allowed],
  );
  return result.rows[0] ?? null;
}

/**
 * Look up just the content tier for a slug (no access check).
 * Used by the detail page to redirect gated activities to the
 * correct pack page instead of showing a raw 404.
 */
export async function getActivityContentTier(slug: string): Promise<string | null> {
  const result = await sql.query(
    `SELECT tier FROM vault_activities_cache WHERE slug = $1`,
    [slug],
  );
  return (result.rows[0]?.tier as string) ?? null;
}

/**
 * Count vault activities, optionally filtered by content tier.
 * Used by pack detail pages to show activity counts.
 */
export async function getVaultActivityCount(contentTier?: string) {
  if (contentTier) {
    const result = await sql`
      SELECT COUNT(*)::int AS count FROM vault_activities_cache WHERE tier = ${contentTier}
    `;
    return result.rows[0]?.count ?? 0;
  }
  const result = await sql`SELECT COUNT(*)::int AS count FROM vault_activities_cache`;
  return result.rows[0]?.count ?? 0;
}

/**
 * Get related activities for a vault activity.
 * Returns teaser-level columns (related activities are shown as cards).
 * Enforces row-level access — free users only see related PRME activities.
 */
export async function getRelatedActivities(
  activityId: string,
  tier: VaultAccessTier = "teaser",
) {
  const cols = columnsToSql(VAULT_TEASER_COLUMNS);
  const allowed = visibleContentTiers(tier);

  if (!allowed) {
    // practitioner / internal → show all related
    const result = await sql.query(
      `SELECT ${cols} FROM vault_activities_cache vac
       JOIN vault_related_activities vra ON vra.related_activity_id = vac.id
       WHERE vra.vault_activity_id = $1
       ORDER BY vac.name ASC`,
      [activityId],
    );
    return result.rows;
  }

  // Filter related activities by the user's visible content tiers
  const placeholders = allowed.map((_, i) => `$${i + 2}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols} FROM vault_activities_cache vac
     JOIN vault_related_activities vra ON vra.related_activity_id = vac.id
     WHERE vra.vault_activity_id = $1 AND vac.tier IN (${placeholders})
     ORDER BY vac.name ASC`,
    [activityId, ...allowed],
  );
  return result.rows;
}
