/**
 * Invite processing — vault-only subset.
 *
 * Only processInvitesOnSignIn() and its dependencies are needed here.
 * Invite creation/listing/management stays in creaseworks admin.
 */

import { sql } from "@/lib/db";
import { grantUserEntitlement } from "@/lib/queries/entitlements";

interface Invite {
  id: string;
  email: string;
  tier: string;
  invited_by: string;
  expires_at: string | null;
}

interface InvitePack {
  invite_id: string;
  pack_cache_id: string;
}

/**
 * Check if an email has pending (unclaimed, non-expired) invites.
 */
async function getPendingInvitesForEmail(email: string): Promise<Invite[]> {
  const r = await sql.query(
    `SELECT * FROM invites
      WHERE lower(email) = lower(trim($1))
        AND accepted_at IS NULL
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY invited_at DESC`,
    [email],
  );
  return r.rows;
}

/**
 * Fetch pack IDs for ALL given invite IDs in a single query.
 * Eliminates the N+1 pattern of querying per invite.
 */
async function getPacksForInvites(inviteIds: string[]): Promise<Map<string, string[]>> {
  if (inviteIds.length === 0) return new Map();

  const placeholders = inviteIds.map((_, i) => `$${i + 1}`).join(", ");
  const r = await sql.query(
    `SELECT invite_id, pack_cache_id FROM invite_packs WHERE invite_id IN (${placeholders})`,
    inviteIds,
  );

  const map = new Map<string, string[]>();
  for (const row of r.rows as InvitePack[]) {
    const existing = map.get(row.invite_id) ?? [];
    existing.push(row.pack_cache_id);
    map.set(row.invite_id, existing);
  }
  return map;
}

/**
 * Mark multiple invites as accepted in a single UPDATE.
 */
async function acceptInvites(inviteIds: string[], userId: string) {
  if (inviteIds.length === 0) return;
  const placeholders = inviteIds.map((_, i) => `$${i + 2}`).join(", ");
  await sql.query(
    `UPDATE invites SET accepted_at = NOW(), accepted_by = $1 WHERE id IN (${placeholders})`,
    [userId, ...inviteIds],
  );
}

/**
 * Process pending invites when a user signs in.
 *
 * For each unclaimed invite matching the user's email:
 * 1. Grant user-level entitlements for each associated pack
 * 2. Mark the invite as accepted
 *
 * Called from the JWT callback in auth.ts — runs once per initial sign-in.
 * Idempotent: grantUserEntitlement uses upsert logic internally.
 *
 * Uses batched queries to avoid N+1 patterns:
 * - 1 query: fetch all pending invites
 * - 1 query: fetch all packs for those invites (was N queries)
 * - N queries: grant entitlements (each is an upsert, hard to batch safely)
 * - 1 query: mark all invites accepted (was N queries)
 */
export async function processInvitesOnSignIn(
  userId: string,
  email: string,
): Promise<void> {
  const pending = await getPendingInvitesForEmail(email);
  if (pending.length === 0) return;

  // Batch-fetch all packs for all invites in one query
  const inviteIds = pending.map((inv) => inv.id);
  const packsByInvite = await getPacksForInvites(inviteIds);

  // Grant entitlements for each invite's packs
  for (const invite of pending) {
    const packIds = packsByInvite.get(invite.id) ?? [];
    for (const packId of packIds) {
      await grantUserEntitlement(userId, packId, invite.expires_at);
    }
  }

  // Batch-accept all invites in one query
  await acceptInvites(inviteIds, userId);
}
