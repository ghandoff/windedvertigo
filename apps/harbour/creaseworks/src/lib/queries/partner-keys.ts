/**
 * Partner API key queries — manage and validate partner API keys.
 *
 * Partner API keys allow external integrations to access aggregate org data
 * via the /api/partner endpoints. Keys are hashed for storage and only returned
 * once at creation time.
 *
 * Key format: cw_pk_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (prefix + 32 random hex chars)
 * Storage: SHA-256 hash of the full key
 */

import { sql } from "@/lib/db";
import { createHash, randomBytes } from "crypto";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface PartnerApiKey {
  id: string;
  org_id: string;
  key_prefix: string;
  label: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface CreateKeyResponse {
  key: PartnerApiKey;
  fullKey: string;
}

/* ------------------------------------------------------------------ */
/*  key generation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Generate a new partner API key.
 * Returns the full key (for one-time display), hash (for storage), and prefix.
 */
export function generateApiKey(): {
  fullKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  // Generate 32 random hex bytes (64 hex characters)
  const randomPart = randomBytes(32).toString("hex");
  const fullKey = `cw_pk_${randomPart}`;

  // SHA-256 hash of the full key
  const keyHash = createHash("sha256").update(fullKey).digest("hex");

  // First 8 characters (cw_pk_ + 2 more)
  const keyPrefix = fullKey.substring(0, 8);

  return { fullKey, keyHash, keyPrefix };
}

/* ------------------------------------------------------------------ */
/*  create                                                             */
/* ------------------------------------------------------------------ */

/**
 * Create a new partner API key for an organization.
 * Returns the full key ONCE (only at creation).
 * The full key is NEVER stored in the database — only the hash.
 */
export async function createPartnerKey(
  orgId: string,
  label: string,
  scopes?: string[],
): Promise<CreateKeyResponse> {
  const { fullKey, keyHash, keyPrefix } = generateApiKey();

  // Default scopes
  const defaultScopes = scopes || ["read:progress", "read:gallery"];

  const result = await sql.query(
    `INSERT INTO partner_api_keys (id, org_id, key_hash, key_prefix, label, scopes, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
     RETURNING id, org_id, key_prefix, label, scopes, last_used_at, expires_at, created_at`,
    [orgId, keyHash, keyPrefix, label, defaultScopes],
  );

  const row = result.rows[0];
  const key: PartnerApiKey = {
    id: row.id,
    org_id: row.org_id,
    key_prefix: row.key_prefix,
    label: row.label,
    scopes: row.scopes,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    revoked_at: null,
  };

  return { key, fullKey };
}

/* ------------------------------------------------------------------ */
/*  validate                                                           */
/* ------------------------------------------------------------------ */

/**
 * Validate a provided API key.
 * Returns org_id and scopes if valid, null otherwise.
 * Updates last_used_at on successful validation.
 */
export async function validatePartnerKey(
  apiKey: string,
): Promise<{ orgId: string; scopes: string[] } | null> {
  // Hash the provided key
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  // Look up by hash: must not be revoked and must not be expired
  const result = await sql.query(
    `SELECT id, org_id, scopes
     FROM partner_api_keys
     WHERE key_hash = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [keyHash],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Update last_used_at (fire-and-forget)
  sql.query(
    `UPDATE partner_api_keys
     SET last_used_at = NOW()
     WHERE id = $1`,
    [row.id],
  ).catch((err) => {
    console.error("[partner-keys] failed to update last_used_at:", err);
  });

  return {
    orgId: row.org_id,
    scopes: row.scopes,
  };
}

/* ------------------------------------------------------------------ */
/*  list                                                               */
/* ------------------------------------------------------------------ */

/**
 * List all non-revoked API keys for an organization.
 * Never exposes the full key — only the prefix and metadata.
 */
export async function listPartnerKeys(orgId: string): Promise<PartnerApiKey[]> {
  const result = await sql.query(
    `SELECT id, org_id, key_prefix, label, scopes, last_used_at, expires_at, created_at, revoked_at
     FROM partner_api_keys
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [orgId],
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    org_id: row.org_id,
    key_prefix: row.key_prefix,
    label: row.label,
    scopes: row.scopes,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
  }));
}

/* ------------------------------------------------------------------ */
/*  revoke                                                             */
/* ------------------------------------------------------------------ */

/**
 * Revoke a partner API key.
 * Returns true if successful, false if not found or org_id mismatch.
 */
export async function revokePartnerKey(
  keyId: string,
  orgId: string,
): Promise<boolean> {
  const result = await sql.query(
    `UPDATE partner_api_keys
     SET revoked_at = NOW()
     WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [keyId, orgId],
  );

  return result.rows.length > 0;
}
