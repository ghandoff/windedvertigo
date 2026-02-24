/**
 * Evidence share queries — CRUD for shareable portfolio links.
 *
 * Phase D — evidence export (practitioner tier).
 *
 * Each share is a time-limited public token granting read-only access
 * to a filtered subset of a user's evidence portfolio.
 */

import { sql } from "@/lib/db";
import { randomBytes } from "crypto";
import type { CWSession } from "@/lib/auth-helpers";
import type { EvidenceType } from "@/lib/queries/evidence";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface ShareFilters {
  type?: EvidenceType | null;
  playdate?: string | null;
}

export interface EvidenceShareRow {
  id: string;
  user_id: string;
  token: string;
  filters: ShareFilters;
  expires_at: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  create                                                             */
/* ------------------------------------------------------------------ */

/**
 * Create a shareable link for the current user's evidence.
 * Returns the share record with a unique URL-safe token.
 */
export async function createShare(
  userId: string,
  filters: ShareFilters = {},
  expiresInDays = 7,
): Promise<EvidenceShareRow> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const result = await sql.query(
    `INSERT INTO evidence_shares (user_id, token, filters, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, token, filters, expires_at, created_at`,
    [userId, token, JSON.stringify(filters), expiresAt.toISOString()],
  );

  return result.rows[0] as EvidenceShareRow;
}

/* ------------------------------------------------------------------ */
/*  read                                                               */
/* ------------------------------------------------------------------ */

/**
 * Look up a share by its public token.
 * Returns null if the token doesn't exist or has expired.
 */
export async function getShareByToken(
  token: string,
): Promise<EvidenceShareRow | null> {
  const result = await sql.query(
    `SELECT id, user_id, token, filters, expires_at, created_at
     FROM evidence_shares
     WHERE token = $1
       AND expires_at > now()`,
    [token],
  );

  if (result.rows.length === 0) return null;
  return result.rows[0] as EvidenceShareRow;
}

/* ------------------------------------------------------------------ */
/*  delete                                                             */
/* ------------------------------------------------------------------ */

/**
 * Revoke a share. Caller must own the share or be an admin.
 * Returns true if deleted, false if not found or not authorised.
 */
export async function deleteShare(
  shareId: string,
  session: CWSession,
): Promise<boolean> {
  const condition = session.isAdmin
    ? "id = $1"
    : "id = $1 AND user_id = $2";
  const params = session.isAdmin
    ? [shareId]
    : [shareId, session.userId];

  const result = await sql.query(
    `DELETE FROM evidence_shares WHERE ${condition}`,
    params,
  );

  return (result.rowCount ?? 0) > 0;
}
