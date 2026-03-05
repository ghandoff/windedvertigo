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
 * Mark an invite as accepted by a user.
 */
async function acceptInvite(inviteId: string, userId: string) {
  await sql.query(
    `UPDATE invites SET accepted_at = NOW(), accepted_by = $2 WHERE id = $1`,
    [inviteId, userId],
  );
}

/**
 * Fetch pack IDs associated with an invite.
 */
async function getInvitePacks(inviteId: string): Promise<string[]> {
  const r = await sql.query(
    `SELECT pack_cache_id FROM invite_packs WHERE invite_id = $1`,
    [inviteId],
  );
  return r.rows.map((row: { pack_cache_id: string }) => row.pack_cache_id);
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
 */
export async function processInvitesOnSignIn(
  userId: string,
  email: string,
): Promise<void> {
  const pending = await getPendingInvitesForEmail(email);
  if (pending.length === 0) return;

  for (const invite of pending) {
    const packIds = await getInvitePacks(invite.id);

    // Grant user-level entitlements for each pack
    for (const packId of packIds) {
      await grantUserEntitlement(userId, packId, invite.expires_at);
    }

    // Mark invite as accepted
    await acceptInvite(invite.id, userId);
  }
}
