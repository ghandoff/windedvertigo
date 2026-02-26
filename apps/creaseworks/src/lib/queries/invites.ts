import { sql } from "@/lib/db";

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
  return r.rows;
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
