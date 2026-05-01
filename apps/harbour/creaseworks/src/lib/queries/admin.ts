/**
 * Admin queries — domain blocklist and admin allowlist management.
 *
 * MVP 4 — admin pages and rate limiting.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  domain blocklist                                                   */
/* ------------------------------------------------------------------ */

/** Fetch all blocklist entries, ordered by domain. */
export async function getAllBlockedDomains() {
  const r = await sql.query(
    `SELECT id, domain, enabled, reason, added_by, created_at, updated_at
     FROM domain_blocklist
     ORDER BY domain ASC`,
  );
  return r.rows;
}

/** Add a domain to the blocklist. */
export async function addBlockedDomain(
  domain: string,
  reason: string | null,
  addedBy: string,
) {
  const r = await sql.query(
    `INSERT INTO domain_blocklist (domain, reason, added_by, enabled)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (domain) DO UPDATE SET
       reason = COALESCE($2, domain_blocklist.reason),
       enabled = TRUE,
       updated_at = NOW()
     RETURNING id, domain, enabled, reason`,
    [domain.toLowerCase().trim(), reason, addedBy],
  );
  return r.rows[0];
}

/** Toggle enabled/disabled on a blocklist entry. */
export async function toggleBlockedDomain(id: string, enabled: boolean) {
  await sql.query(
    `UPDATE domain_blocklist
     SET enabled = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, enabled],
  );
}

/** Update the reason on a blocklist entry. */
export async function updateBlockedDomainReason(id: string, reason: string) {
  await sql.query(
    `UPDATE domain_blocklist
     SET reason = $1, updated_at = NOW()
     WHERE id = $2`,
    [reason, id],
  );
}

/** Delete a domain from the blocklist. */
export async function deleteBlockedDomain(id: string) {
  await sql.query(
    `DELETE FROM domain_blocklist WHERE id = $1`,
    [id],
  );
}

/* ------------------------------------------------------------------ */
/*  admin allowlist                                                    */
/* ------------------------------------------------------------------ */

/** Fetch all admins with user details. */
export async function getAllAdmins() {
  const r = await sql.query(
    `SELECT
       a.id,
       a.user_id,
       u.email,
       u.name,
       gb.email AS granted_by_email,
       a.created_at
     FROM admin_allowlist a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN users gb ON gb.id = a.granted_by
     ORDER BY a.created_at ASC`,
  );
  return r.rows;
}

/** Add a user to the admin allowlist by email. Returns the admin row or null if user not found. */
export async function addAdminByEmail(email: string, grantedBy: string) {
  // look up user
  const userResult = await sql.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase().trim()],
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const r = await sql.query(
    `INSERT INTO admin_allowlist (user_id, granted_by)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING id, user_id`,
    [user.id, grantedBy],
  );
  return r.rows[0] ?? { id: "existing", user_id: user.id };
}

/** Remove a user from the admin allowlist. */
export async function removeAdmin(adminId: string) {
  await sql.query(
    `DELETE FROM admin_allowlist WHERE id = $1`,
    [adminId],
  );
}

/** Count total admins. */
export async function countAdmins(): Promise<number> {
  const r = await sql.query(
    `SELECT COUNT(*) AS count FROM admin_allowlist`,
  );
  return parseInt(r.rows[0].count, 10);
}
