import { sql } from "@/lib/db";
import crypto from "crypto";

export async function isBlockedDomain(domain: string): Promise<boolean> {
  const r = await sql.query(
    "SELECT 1 FROM domain_blocklist WHERE domain = $1 AND enabled = TRUE LIMIT 1",
    [domain.toLowerCase().trim()],
  );
  return r.rows.length > 0;
}

export async function getOrgByVerifiedDomain(domain: string) {
  const r = await sql.query(
    "SELECT o.id AS org_id, o.name AS org_name, vd.domain FROM verified_domains vd JOIN organisations o ON o.id = vd.org_id WHERE vd.domain = $1 AND vd.verified = TRUE LIMIT 1",
    [domain.toLowerCase().trim()],
  );
  return r.rows[0] ?? null;
}

export async function getOrgMembership(userId: string) {
  const r = await sql.query(
    "SELECT om.org_id, o.name AS org_name, om.role FROM org_memberships om JOIN organisations o ON o.id = om.org_id WHERE om.user_id = $1 LIMIT 1",
    [userId],
  );
  return r.rows[0] ?? null;
}

export async function autoJoinOrg(userId: string, email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  if (await isBlockedDomain(domain)) return null;
  const org = await getOrgByVerifiedDomain(domain);
  if (!org) return null;
  const r = await sql.query(
    "INSERT INTO org_memberships (user_id, org_id, role) VALUES ($1, $2, 'member') ON CONFLICT (user_id, org_id) DO NOTHING RETURNING org_id, role",
    [userId, org.org_id],
  );
  return r.rows[0] ?? { org_id: org.org_id, role: "member" };
}

export async function createOrganisation(name: string) {
  const r = await sql.query(
    "INSERT INTO organisations (name) VALUES ($1) RETURNING id, name, created_at",
    [name.toLowerCase().trim()],
  );
  return r.rows[0];
}

export async function addVerifiedDomain(
  orgId: string,
  domain: string,
  verificationEmail: string,
) {
  const token = crypto.randomBytes(32).toString("hex");
  // Token expires in 24 hours — audit fix: tokens previously had no TTL.
  // The ON CONFLICT only refreshes the token for unverified domains.
  // If the domain is already verified we leave it alone (no-op update
  // that preserves all existing values).
  const r = await sql.query(
    `INSERT INTO verified_domains (org_id, domain, verification_token, verification_email, token_expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
     ON CONFLICT (domain) DO UPDATE SET
       verification_token = CASE
         WHEN verified_domains.verified = FALSE THEN $3
         ELSE verified_domains.verification_token
       END,
       verification_email = CASE
         WHEN verified_domains.verified = FALSE THEN $4
         ELSE verified_domains.verification_email
       END,
       token_expires_at = CASE
         WHEN verified_domains.verified = FALSE THEN NOW() + INTERVAL '24 hours'
         ELSE verified_domains.token_expires_at
       END
     RETURNING id, domain, verification_token, verified`,
    [orgId, domain.toLowerCase().trim(), token, verificationEmail.toLowerCase().trim()],
  );
  return r.rows[0];
}

/**
 * Look up a domain record by its verification token — used to
 * distinguish "already verified" from "genuinely invalid" when the
 * verify endpoint's UPDATE returns no rows.
 */
export async function getDomainByToken(token: string) {
  const r = await sql.query(
    `SELECT id, domain, verified
     FROM verified_domains
     WHERE verification_token = $1
     LIMIT 1`,
    [token],
  );
  return r.rows[0] ?? null;
}

export async function verifyDomainByToken(token: string) {
  // Only accept tokens that haven't expired — audit fix: previously
  // tokens were valid forever, so a leaked token could be used at any
  // point in the future.
  const r = await sql.query(
    `UPDATE verified_domains
     SET verified = TRUE, verified_at = NOW()
     WHERE verification_token = $1
       AND verified = FALSE
       AND (token_expires_at IS NULL OR token_expires_at > NOW())
     RETURNING id, org_id, domain`,
    [token],
  );
  const row = r.rows[0];
  if (!row) return null;
  // auto-join existing users with matching email domain
  await sql.query(
    "INSERT INTO org_memberships (user_id, org_id, role) SELECT u.id, $1, 'member' FROM users u WHERE u.email LIKE '%@' || $2 AND NOT EXISTS (SELECT 1 FROM org_memberships om WHERE om.user_id = u.id AND om.org_id = $1)",
    [row.org_id, row.domain],
  );
  return row;
}

/**
 * Fetch all organisations. Used by admin entitlements page
 * to populate the org dropdown.
 */
export async function getAllOrganisations() {
  const r = await sql.query(
    "SELECT id, name, created_at FROM organisations ORDER BY name ASC",
  );
  return r.rows;
}

/**
 * List all members of an organisation with user details.
 * Used by the team management page.
 */
export async function getOrgMembers(orgId: string) {
  const r = await sql.query(
    `SELECT om.id AS membership_id, om.user_id, om.role, om.joined_at,
            u.email, u.name
     FROM org_memberships om
     JOIN users u ON u.id = om.user_id
     WHERE om.org_id = $1
     ORDER BY om.role DESC, om.joined_at ASC`,
    [orgId],
  );
  return r.rows;
}

/**
 * Update a member's role within an organisation.
 * Only org admins should call this.
 */
export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: "member" | "admin",
) {
  const r = await sql.query(
    "UPDATE org_memberships SET role = $1 WHERE org_id = $2 AND user_id = $3 RETURNING id, role",
    [role, orgId, userId],
  );
  return r.rows[0] ?? null;
}

/**
 * Remove a member from an organisation.
 * Only org admins should call this. Cannot remove yourself.
 */
export async function removeMember(orgId: string, userId: string) {
  const r = await sql.query(
    "DELETE FROM org_memberships WHERE org_id = $1 AND user_id = $2 RETURNING id",
    [orgId, userId],
  );
  return r.rows[0] ?? null;
}

/**
 * Count org admins. Used to prevent removing the last admin.
 */
export async function countOrgAdmins(orgId: string): Promise<number> {
  const r = await sql.query(
    "SELECT COUNT(*) AS count FROM org_memberships WHERE org_id = $1 AND role = 'admin'",
    [orgId],
  );
  return parseInt(r.rows[0]?.count || "0", 10);
}

/**
 * Get an organisation's Stripe customer ID (null if not yet created).
 */
export async function getOrgStripeCustomerId(
  orgId: string,
): Promise<string | null> {
  const r = await sql.query(
    "SELECT stripe_customer_id FROM organisations WHERE id = $1 LIMIT 1",
    [orgId],
  );
  return r.rows[0]?.stripe_customer_id ?? null;
}

/**
 * Store a Stripe customer ID on an organisation.
 */
export async function setOrgStripeCustomerId(
  orgId: string,
  customerId: string,
): Promise<void> {
  await sql.query(
    "UPDATE organisations SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2",
    [customerId, orgId],
  );
}

/* ------------------------------------------------------------------ */
/*  verified domains — self-service domain verification (session 12)   */
/* ------------------------------------------------------------------ */

/**
 * List all verified_domains rows for an organisation.
 * Used by the team page to show domain verification status.
 */
export async function getOrgVerifiedDomains(orgId: string) {
  const r = await sql.query(
    `SELECT id, domain, verified, verification_email, verified_at, created_at
     FROM verified_domains
     WHERE org_id = $1
     ORDER BY domain ASC`,
    [orgId],
  );
  return r.rows;
}

/**
 * Remove a verified domain record. Only org admins should call this.
 * If the domain was verified, this will NOT remove existing org memberships
 * (members who already joined stay). It just prevents future auto-joins.
 */
export async function removeVerifiedDomain(orgId: string, domainId: string) {
  const r = await sql.query(
    "DELETE FROM verified_domains WHERE id = $1 AND org_id = $2 RETURNING id",
    [domainId, orgId],
  );
  return r.rows[0] ?? null;
}
