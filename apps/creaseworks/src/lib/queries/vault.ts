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
  const packMap = new Map<string, string>(packs.rows.map((r: any) => [r.slug, r.id]));

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
 * List all vault activities at the specified tier level.
 *
 * For teaser tier, all activities are returned (PRME + paid tiers)
 * so users can browse the full catalog. The tier column selection
 * controls what fields are exposed, not which rows are returned.
 */
export async function getVaultActivities(tier: VaultAccessTier) {
  const cols = columnsForTier(tier);
  const result = await sql.query(
    `SELECT ${cols} FROM vault_activities_cache ORDER BY name ASC`,
  );
  return result.rows;
}

/**
 * List vault activities filtered by content tier.
 * E.g. "show only PRME activities" or "show only explorer activities".
 */
export async function getVaultActivitiesByTier(
  accessTier: VaultAccessTier,
  contentTier: string,
) {
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
 * Caller determines the access tier via resolveVaultTier().
 *
 * PRME elevation: PRME activities are contractually free, so teaser-tier
 * viewers get entitled-level columns (body_html, materials, etc.).
 * The returned `_effectiveTier` tells the caller which column set was used.
 */
export async function getVaultActivityBySlug(
  slug: string,
  tier: VaultAccessTier,
) {
  // For teaser tier, check if this is a PRME activity and elevate columns
  if (tier === "teaser") {
    const check = await sql.query(
      `SELECT tier FROM vault_activities_cache WHERE slug = $1`,
      [slug],
    );
    if (check.rows[0]?.tier === "prme") {
      const cols = columnsForTier("entitled");
      const result = await sql.query(
        `SELECT ${cols} FROM vault_activities_cache WHERE slug = $1`,
        [slug],
      );
      const row = result.rows[0] ?? null;
      if (row) row._effectiveTier = "entitled";
      return row;
    }
  }

  const cols = columnsForTier(tier);
  const result = await sql.query(
    `SELECT ${cols} FROM vault_activities_cache WHERE slug = $1`,
    [slug],
  );
  const row = result.rows[0] ?? null;
  if (row) row._effectiveTier = tier;
  return row;
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
 * Get vault activities for a pack detail page.
 *
 * For explorer pack: shows all activities (teaser columns)
 * For practitioner pack: shows all activities (teaser columns)
 *
 * The pack page shows activity previews — the tier-based column gating
 * happens on the individual activity detail page, not the pack listing.
 */
export async function getVaultActivitiesForPackPage() {
  const cols = columnsForTier("teaser");
  const result = await sql.query(
    `SELECT ${cols} FROM vault_activities_cache ORDER BY name ASC`,
  );
  return result.rows;
}

/**
 * Get related activities for a vault activity.
 * Always returns teaser-level columns (related activities are shown as cards).
 */
export async function getRelatedActivities(activityId: string) {
  const cols = columnsToSql(VAULT_TEASER_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols} FROM vault_activities_cache vac
     JOIN vault_related_activities vra ON vra.related_activity_id = vac.id
     WHERE vra.vault_activity_id = $1
     ORDER BY vac.name ASC`,
    [activityId],
  );
  return result.rows;
}
