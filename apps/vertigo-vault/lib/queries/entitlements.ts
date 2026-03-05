/**
 * Entitlement queries — vault-only subset.
 *
 * Supports dual-scope: org-level (shared by whole org) AND
 * user-level (individual access via invites or direct purchase).
 */

import { sql } from "@/lib/db";

/**
 * Check whether an org or user has an active entitlement for a pack.
 * Active = granted, not revoked, not expired.
 *
 * Either org-level or user-level match is sufficient.
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
 * Uses upsert logic to handle re-grants (clears revoked_at).
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

  // Try to revive a revoked row, then insert if needed
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
 * Used for invite-based access and individual (no-org) purchases.
 */
export async function grantUserEntitlement(
  userId: string,
  packCacheId: string,
  expiresAt?: string | null,
  purchaseId?: string | null,
) {
  // ensure packs_catalogue row exists
  await sql.query(
    `INSERT INTO packs_catalogue (pack_cache_id, visible)
     VALUES ($1, false)
     ON CONFLICT (pack_cache_id) DO NOTHING`,
    [packCacheId],
  );

  // Try to revive an existing user-level entitlement
  const existing = await sql.query(
    `UPDATE entitlements
     SET revoked_at = NULL,
         granted_at = COALESCE(entitlements.granted_at, NOW()),
         expires_at = $3,
         purchase_id = COALESCE($4, entitlements.purchase_id)
     WHERE user_id = $1
       AND pack_cache_id = $2
       AND org_id IS NULL
     RETURNING id`,
    [userId, packCacheId, expiresAt || null, purchaseId || null],
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const result = await sql.query(
    `INSERT INTO entitlements (user_id, pack_cache_id, granted_at, expires_at, purchase_id)
     VALUES ($1, $2, NOW(), $3, $4)
     RETURNING id`,
    [userId, packCacheId, expiresAt || null, purchaseId || null],
  );
  return result.rows[0];
}
