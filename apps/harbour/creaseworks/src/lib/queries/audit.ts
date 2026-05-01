/**
 * Access audit logging queries.
 *
 * MVP 2 — entitlements, pack-only content, watermarking.
 *
 * Every access to entitled content writes a row to access_audit_logs.
 * Actions: 'view_entitled', 'download_pdf', 'view_sampler', 'admin_grant_entitlement',
 *          'create_run', 'update_run', 'export_runs_csv', 'export_runs_pdf',
 *          'domain_verification_initiated', 'domain_verification_removed'
 *
 * Audit fix #14: fieldsAccessed is now typed and documented.
 *
 * The `fields_accessed` column (TEXT[]) should contain one of:
 *   - Actual field/column names that were accessed or modified
 *     e.g. ["title", "run_type", "run_date"] for create_run
 *   - Empty array when not applicable
 *
 * For metadata (counts, domain names, etc.), use the separate
 * `metadata` parameter which stores as a JSONB-serialised string
 * in the last element of fields_accessed for backwards compat.
 */

import { sql } from "@/lib/db";

/**
 * Log an access event to the audit trail.
 *
 * @param fieldsAccessed - Array of field/column names accessed or modified.
 *   Use actual column names, not metadata. For metadata, use the `metadata` param.
 * @param metadata - Optional key-value metadata (e.g. { count: 42, domain: "example.com" }).
 *   Stored as a serialised JSON string in the fields_accessed array for backwards compat.
 */
export async function logAccess(
  userId: string,
  orgId: string | null,
  playdateId: string | null,
  packId: string | null,
  action: string,
  ipAddress: string | null,
  fieldsAccessed: string[],
  metadata?: Record<string, string | number>,
) {
  // Merge metadata into the array as a JSON string for backwards compat.
  // New code should query by action + parse the last element as JSON when needed.
  const fields = [...fieldsAccessed];
  if (metadata && Object.keys(metadata).length > 0) {
    fields.push(`meta:${JSON.stringify(metadata)}`);
  }

  await sql.query(
    `INSERT INTO access_audit_logs
       (user_id, org_id, playdate_id, pack_id, action, ip_address, fields_accessed)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, orgId, playdateId, packId, action, ipAddress, fields],
  );
}
