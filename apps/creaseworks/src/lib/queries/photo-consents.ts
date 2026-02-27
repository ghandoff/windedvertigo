/**
 * Photo consent queries — COPPA 2025 three-tier system.
 *
 * Consent tiers:
 *   artifact   — craft, drawing, built thing (auto-approved for marketing)
 *   activity   — hands at work, environment shot (opt-in marketing)
 *   face       — identifiable child/person (requires signed waiver)
 *
 * Phase 4 — engagement system.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export type ConsentTier = "artifact" | "activity" | "face";

export interface PhotoConsentRow {
  id: string;
  run_evidence_id: string;
  user_id: string;
  consent_tier: ConsentTier;
  marketing_approved: boolean;
  parent_name: string | null;
  child_age_range: string | null;
  waiver_signed_at: string | null;
  waiver_ip: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreatePhotoConsentInput {
  runEvidenceId: string;
  userId: string;
  consentTier: ConsentTier;
  marketingApproved: boolean;
  parentName?: string | null;
  childAgeRange?: string | null;
  waiverIp?: string | null;
}

/* ------------------------------------------------------------------ */
/*  create consent                                                     */
/* ------------------------------------------------------------------ */

/**
 * Create a photo consent record. For face-tier, also sets waiver_signed_at.
 * Returns the consent ID.
 */
export async function createPhotoConsent(
  input: CreatePhotoConsentInput,
): Promise<string> {
  const isFaceTier = input.consentTier === "face";

  const result = await sql.query(
    `INSERT INTO photo_consents
       (run_evidence_id, user_id, consent_tier, marketing_approved,
        parent_name, child_age_range, waiver_signed_at, waiver_ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.runEvidenceId,
      input.userId,
      input.consentTier,
      input.marketingApproved,
      input.parentName ?? null,
      input.childAgeRange ?? null,
      isFaceTier ? new Date().toISOString() : null,
      input.waiverIp ?? null,
    ],
  );

  return result.rows[0].id;
}

/* ------------------------------------------------------------------ */
/*  revoke consent                                                     */
/* ------------------------------------------------------------------ */

/**
 * Revoke a photo consent (soft delete via revoked_at).
 * Users can revoke marketing consent at any time.
 */
export async function revokePhotoConsent(
  consentId: string,
  userId: string,
): Promise<boolean> {
  const result = await sql.query(
    `UPDATE photo_consents
     SET revoked_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL`,
    [consentId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/*  get consent for evidence                                           */
/* ------------------------------------------------------------------ */

/**
 * Get the active consent record for a specific evidence item.
 */
export async function getConsentForEvidence(
  runEvidenceId: string,
): Promise<PhotoConsentRow | null> {
  const result = await sql.query(
    `SELECT * FROM photo_consents
     WHERE run_evidence_id = $1
       AND revoked_at IS NULL
     LIMIT 1`,
    [runEvidenceId],
  );
  return (result.rows[0] as PhotoConsentRow) ?? null;
}

/* ------------------------------------------------------------------ */
/*  marketable photos                                                  */
/* ------------------------------------------------------------------ */

/**
 * Get photos approved for marketing use — consent is active and
 * marketing_approved = true. Returns evidence IDs + consent metadata.
 */
export async function getMarketablePhotos(
  limit: number = 50,
): Promise<Array<PhotoConsentRow & { storage_key: string; thumbnail_key: string }>> {
  const result = await sql.query(
    `SELECT
       pc.*,
       re.storage_key,
       re.thumbnail_key
     FROM photo_consents pc
     JOIN run_evidence re ON re.id = pc.run_evidence_id
     WHERE pc.marketing_approved = true
       AND pc.revoked_at IS NULL
       AND re.storage_key IS NOT NULL
     ORDER BY pc.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

/**
 * Count photos with active marketing consent. For admin dashboard.
 */
export async function countMarketablePhotos(): Promise<number> {
  const result = await sql.query(
    `SELECT COUNT(*)::int AS count
     FROM photo_consents
     WHERE marketing_approved = true
       AND revoked_at IS NULL`,
  );
  return result.rows[0]?.count ?? 0;
}
