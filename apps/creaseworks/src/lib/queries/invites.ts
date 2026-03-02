import { sql } from "@/lib/db";
import { grantUserEntitlement } from "@/lib/queries/entitlements";

export interface Invite {
  id: string;
  email: string;
  tier: string;
  note: string | null;
  invited_by: string;
  invited_by_email?: string;
  invited_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  /** Pack names associated with this invite (populated by listAllInvites) */
  pack_names?: string[];
}

/**
 * Create a complimentary invite for an email address.
 * If an invite already exists for this email+tier, update it (clear revoked_at).
 */
export async function createInvite(
  email: string,
  tier: "explorer" | "practitioner",
  invitedBy: string,
  note?: string,
  expiresAt?: Date,
) {
  const r = await sql.query(
    `INSERT INTO invites (email, tier, invited_by, note, expires_at)
     VALUES (lower(trim($1)), $2, $3, $4, $5)
     ON CONFLICT (email, tier)
     DO UPDATE SET
       invited_by = EXCLUDED.invited_by,
       invited_at = NOW(),
       note = EXCLUDED.note,
       expires_at = EXCLUDED.expires_at,
       revoked_at = NULL,
       accepted_at = NULL,
       accepted_by = NULL
     RETURNING id, email, tier`,
    [email, tier, invitedBy, note ?? null, expiresAt ?? null],
  );
  return r.rows[0];
}

/**
 * List all invites (admin view), most recent first.
 * Enriches each invite with its associated pack names.
 */
export async function listAllInvites(): Promise<Invite[]> {
  const r = await sql.query(
    `SELECT i.*,
            u.email AS invited_by_email
       FROM invites i
       JOIN users u ON u.id = i.invited_by
      WHERE i.revoked_at IS NULL
      ORDER BY i.invited_at DESC`,
  );
  const invites: Invite[] = r.rows;

  // Batch-fetch pack names for all invites
  if (invites.length > 0) {
    const packMap = await batchGetInvitePackNames(invites.map((i) => i.id));
    for (const inv of invites) {
      inv.pack_names = packMap.get(inv.id) ?? [];
    }
  }

  return invites;
}

/**
 * Check if an email has a pending (unclaimed, non-expired) invite.
 * Called during sign-in to auto-entitle users.
 */
export async function getPendingInvitesForEmail(
  email: string,
): Promise<Invite[]> {
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
export async function acceptInvite(inviteId: string, userId: string) {
  await sql.query(
    `UPDATE invites
        SET accepted_at = NOW(),
            accepted_by = $2
      WHERE id = $1`,
    [inviteId, userId],
  );
}

/**
 * Revoke an invite (soft delete).
 */
export async function revokeInvite(inviteId: string) {
  await sql.query(
    `UPDATE invites SET revoked_at = NOW() WHERE id = $1`,
    [inviteId],
  );
}

/* ------------------------------------------------------------------ */
/*  Invite ↔ Pack associations (migration 038)                        */
/* ------------------------------------------------------------------ */

/**
 * Create an invite and associate it with specific packs.
 * Admins choose which packs to grant when creating the invite.
 * On sign-in, the user gets user-level entitlements for these packs.
 */
export async function createInviteWithPacks(
  email: string,
  tier: "explorer" | "practitioner",
  invitedBy: string,
  packIds: string[],
  note?: string,
  expiresAt?: Date,
) {
  const invite = await createInvite(email, tier, invitedBy, note, expiresAt);

  // Associate the invite with each selected pack
  for (const packId of packIds) {
    await sql.query(
      `INSERT INTO invite_packs (invite_id, pack_cache_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [invite.id, packId],
    );
  }

  return invite;
}

/**
 * Fetch pack IDs associated with an invite.
 */
export async function getInvitePacks(inviteId: string): Promise<string[]> {
  const r = await sql.query(
    `SELECT pack_cache_id FROM invite_packs WHERE invite_id = $1`,
    [inviteId],
  );
  return r.rows.map((row: { pack_cache_id: string }) => row.pack_cache_id);
}

/**
 * Fetch pack names associated with invites (batch).
 * Returns a map of inviteId → pack_name[].
 * Used by the admin invite list to show which packs each invite grants.
 */
export async function batchGetInvitePackNames(
  inviteIds: string[],
): Promise<Map<string, string[]>> {
  if (inviteIds.length === 0) return new Map();
  const r = await sql.query(
    `SELECT ip.invite_id, pc.title AS pack_title
     FROM invite_packs ip
     JOIN packs_cache pc ON pc.id = ip.pack_cache_id
     WHERE ip.invite_id = ANY($1)
     ORDER BY pc.title ASC`,
    [inviteIds],
  );
  const map = new Map<string, string[]>();
  for (const row of r.rows) {
    const existing = map.get(row.invite_id) ?? [];
    existing.push(row.pack_title);
    map.set(row.invite_id, existing);
  }
  return map;
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
