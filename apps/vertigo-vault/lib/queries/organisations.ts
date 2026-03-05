/**
 * Organisation queries — vault-only subset.
 *
 * The vault needs org membership for auth JWT, domain auto-join,
 * and Stripe customer management. Admin features (create org,
 * manage members, domain verification) stay in creaseworks.
 */

import { sql } from "@/lib/db";

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

/**
 * Auto-join an org based on verified email domain.
 * Simplified for the vault — no in-app notifications (those live in creaseworks).
 */
export async function autoJoinOrg(userId: string, email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  if (await isBlockedDomain(domain)) return null;
  const org = await getOrgByVerifiedDomain(domain);
  if (!org) return null;

  // Check member cap
  const capResult = await sql.query(
    "SELECT member_cap FROM organisations WHERE id = $1",
    [org.org_id],
  );
  const cap = capResult.rows[0]?.member_cap;
  if (cap != null) {
    const countResult = await sql.query(
      "SELECT COUNT(*) AS count FROM org_memberships WHERE org_id = $1",
      [org.org_id],
    );
    if (parseInt(countResult.rows[0].count, 10) >= cap) {
      console.log(
        `[auth] org ${org.org_id} at member cap (${cap}), skipping auto-join for ${email}`,
      );
      return null;
    }
  }

  const r = await sql.query(
    "INSERT INTO org_memberships (user_id, org_id, role) VALUES ($1, $2, 'member') ON CONFLICT (user_id, org_id) DO NOTHING RETURNING org_id, role",
    [userId, org.org_id],
  );

  return r.rows[0] ?? { org_id: org.org_id, role: "member" };
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
