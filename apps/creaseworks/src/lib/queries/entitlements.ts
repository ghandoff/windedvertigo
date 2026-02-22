/**
 * Entitlement queries — check, grant, list, revoke.
 *
 * MVP 2 — entitlements, pack-only content, watermarking.
 */

import { sql } from "@/lib/db";

/**
 * Check whether an organisation has an active entitlement for a pack.
 * Active = granted, not revoked, not expired.
 */
export async function checkEntitlement(
  orgId: string | null,
  packCacheId: string,
): Promise<boolean> {
  if (!orgId) return false;

  const result = await sql.query(
    `SELECT 1 FROM entitlements
     WHERE org_id = $1
       AND pack_cache_id = $2
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [orgId, packCacheId],
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

  const result = await sql.query(
    `INSERT INTO entitlements (org_id, pack_cache_id, purchase_id, granted_at, expires_at)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (org_id, pack_cache_id)
     DO UPDATE SET
       revoked_at = NULL,
       purchase_id = COALESCE($3, entitlements.purchase_id),
       granted_at = COALESCE(entitlements.granted_at, NOW()),
       expires_at = $4
     RETURNING id`,
    [orgId, packCacheId, purchaseId || null, expiresAt || null],
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
 * Admin: list all entitlements with org and pack names.
 */
export async function listAllEntitlements() {
  const result = await sql.query(
    `SELECT
       e.id,
       e.org_id,
       o.name AS org_name,
       e.pack_cache_id,
       pc.title AS pack_title,
       e.granted_at,
       e.expires_at,
       e.revoked_at
     FROM entitlements e
     JOIN organisations o ON o.id = e.org_id
     JOIN packs_cache pc ON pc.id = e.pack_cache_id
     ORDER BY e.granted_at DESC`,
  );
  return result.rows;
}
