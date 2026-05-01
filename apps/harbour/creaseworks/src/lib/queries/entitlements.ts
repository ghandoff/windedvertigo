/**
 * Entitlement queries — check, grant, list, revoke.
 *
 * MVP 2 — entitlements, pack-only content, watermarking.
 */

import { sql } from "@/lib/db";

/**
 * Check whether an org or user has an active entitlement for a pack.
 * Active = granted, not revoked, not expired.
 *
 * Supports dual-scope: checks org-level entitlements (pack subscriptions
 * shared by the whole org) AND user-level entitlements (individual access
 * granted via invites). Either scope matching is sufficient.
 */
export async function checkEntitlement(
  orgId: string | null,
  packCacheId: string,
  userId?: string | null,
): Promise<boolean> {
  if (!orgId && !userId) return false;

  const result = await sql.query(
    `SELECT 1 FROM entitlements
     WHERE pack_cache_id = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (
         (org_id = $2 AND $2 IS NOT NULL)
         OR
         (user_id = $3 AND $3 IS NOT NULL)
       )
     LIMIT 1`,
    [packCacheId, orgId ?? null, userId ?? null],
  );
  return result.rows.length > 0;
}

/**
 * Grant an entitlement to an organisation for a pack.
 * Auto-creates a packs_catalogue row if one doesn't exist yet.
 * Uses ON CONFLICT to handle re-grants (clears revoked_at).
 *
 * Session 11: added optional expiresAt for free trial grants.
 * Pass an ISO date string (e.g. 14 days from now) to create a
 * time-limited entitlement. checkEntitlement already respects
 * expires_at, so no other code changes needed.
 */
export async function grantEntitlement(
  orgId: string,
  packCacheId: string,
  purchaseId?: string | null,
  expiresAt?: string | null,
) {
  // ensure packs_catalogue row exists (visible=false by default)
  await sql.query(
    `INSERT INTO packs_catalogue (pack_cache_id, visible)
     VALUES ($1, false)
     ON CONFLICT (pack_cache_id) DO NOTHING`,
    [packCacheId],
  );

  // Use the partial unique index for org-level entitlements.
  // idx_entitlements_org_pack covers (org_id, pack_cache_id) WHERE user_id IS NULL AND revoked_at IS NULL.
  // We first try to revive a revoked row, then insert if needed.
  const existing = await sql.query(
    `UPDATE entitlements
     SET revoked_at = NULL,
         purchase_id = COALESCE($3, entitlements.purchase_id),
         granted_at = COALESCE(entitlements.granted_at, NOW()),
         expires_at = $4
     WHERE org_id = $1
       AND pack_cache_id = $2
       AND user_id IS NULL
     RETURNING id`,
    [orgId, packCacheId, purchaseId || null, expiresAt || null],
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const result = await sql.query(
    `INSERT INTO entitlements (org_id, pack_cache_id, purchase_id, granted_at, expires_at)
     VALUES ($1, $2, $3, NOW(), $4)
     RETURNING id`,
    [orgId, packCacheId, purchaseId || null, expiresAt || null],
  );
  return result.rows[0];
}

/**
 * Grant an entitlement to an individual user for a pack.
 * Used when processing invite-based access — the user gets personal
 * entitlements for admin-selected packs, independent of any org.
 *
 * Re-grants (e.g. after a revoke) are handled by updating the existing
 * row rather than inserting a duplicate.
 */
export async function grantUserEntitlement(
  userId: string,
  packCacheId: string,
  expiresAt?: string | null,
) {
  // ensure packs_catalogue row exists (visible=false by default)
  await sql.query(
    `INSERT INTO packs_catalogue (pack_cache_id, visible)
     VALUES ($1, false)
     ON CONFLICT (pack_cache_id) DO NOTHING`,
    [packCacheId],
  );

  // Try to revive an existing (possibly revoked) user-level entitlement
  const existing = await sql.query(
    `UPDATE entitlements
     SET revoked_at = NULL,
         granted_at = COALESCE(entitlements.granted_at, NOW()),
         expires_at = $3
     WHERE user_id = $1
       AND pack_cache_id = $2
       AND org_id IS NULL
     RETURNING id`,
    [userId, packCacheId, expiresAt || null],
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const result = await sql.query(
    `INSERT INTO entitlements (user_id, pack_cache_id, granted_at, expires_at)
     VALUES ($1, $2, NOW(), $3)
     RETURNING id`,
    [userId, packCacheId, expiresAt || null],
  );
  return result.rows[0];
}

/**
 * Revoke an entitlement (soft delete via revoked_at).
 */
export async function revokeEntitlement(
  orgId: string,
  packCacheId: string,
) {
  await sql.query(
    `UPDATE entitlements
     SET revoked_at = NOW()
     WHERE org_id = $1
       AND pack_cache_id = $2
       AND revoked_at IS NULL`,
    [orgId, packCacheId],
  );
}

/**
 * List active entitlements for an organisation, with pack names.
 */
export async function listOrgEntitlements(orgId: string) {
  const result = await sql.query(
    `SELECT
       e.id,
       e.pack_cache_id,
       pc.title AS pack_title,
       pc.slug AS pack_slug,
       e.granted_at,
       e.expires_at
     FROM entitlements e
     JOIN packs_cache pc ON pc.id = e.pack_cache_id
     WHERE e.org_id = $1
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
     ORDER BY e.granted_at DESC`,
    [orgId],
  );
  return result.rows;
}

/**
 * Fetch entitled packs for a user with per-user progress breakdown.
 * Checks both org-level and user-level entitlements so individually
 * invited users see their packs alongside any org-granted ones.
 *
 * Joins entitlements → packs_cache → pack_playdates → playdate_progress.
 * Returns one row per entitled pack with playdate count + tier counts.
 */
export async function getOrgPacksWithProgress(
  orgId: string | null,
  userId: string,
) {
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       COUNT(DISTINCT pp.playdate_id)::int AS playdate_count,
       COUNT(DISTINCT CASE WHEN prg.progress_tier IS NOT NULL THEN pp.playdate_id END)::int AS tried_count,
       COUNT(DISTINCT CASE WHEN prg.progress_tier IN ('found_something','folded_unfolded','found_again') THEN pp.playdate_id END)::int AS found_count,
       COUNT(DISTINCT CASE WHEN prg.progress_tier IN ('folded_unfolded','found_again') THEN pp.playdate_id END)::int AS folded_count,
       COUNT(DISTINCT CASE WHEN prg.progress_tier = 'found_again' THEN pp.playdate_id END)::int AS found_again_count
     FROM entitlements e
     JOIN packs_cache pc ON pc.id = e.pack_cache_id
     LEFT JOIN pack_playdates pp ON pp.pack_id = pc.id
     LEFT JOIN playdates_cache plc ON plc.id = pp.playdate_id AND plc.status = 'ready'
     LEFT JOIN playdate_progress prg
       ON prg.playdate_id = pp.playdate_id AND prg.user_id = $2
     WHERE (
         (e.org_id = $1 AND $1 IS NOT NULL)
         OR
         (e.user_id = $2 AND $2 IS NOT NULL)
       )
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
       AND pc.slug IS NOT NULL
     GROUP BY pc.id, pc.slug, pc.title, pc.description
     ORDER BY pc.title ASC`,
    [orgId ?? null, userId],
  );
  return result.rows as Array<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    playdate_count: number;
    tried_count: number;
    found_count: number;
    folded_count: number;
    found_again_count: number;
  }>;
}

/**
 * Admin: list all entitlements with org/user and pack names.
 * Uses LEFT JOINs because org_id or user_id may be NULL.
 */
export async function listAllEntitlements() {
  const result = await sql.query(
    `SELECT
       e.id,
       e.org_id,
       o.name AS org_name,
       e.user_id,
       u.email AS user_email,
       e.pack_cache_id,
       pc.title AS pack_title,
       e.granted_at,
       e.expires_at,
       e.revoked_at
     FROM entitlements e
     LEFT JOIN organisations o ON o.id = e.org_id
     LEFT JOIN users u ON u.id = e.user_id
     JOIN packs_cache pc ON pc.id = e.pack_cache_id
     ORDER BY e.granted_at DESC`,
  );
  return result.rows;
}
