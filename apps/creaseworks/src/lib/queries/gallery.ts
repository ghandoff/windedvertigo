/**
 * Gallery queries — community gallery for opt-in evidence sharing.
 *
 * Users can opt-in to share their evidence (photos, quotes, observations)
 * to a public community gallery. Admin moderation is required to approve
 * items before they appear in the public gallery.
 *
 * Gallery items are anonymized to show only first name of the user.
 */

import { sql } from "@/lib/db";
import type { CWSession } from "@/lib/auth-helpers";
import type { EvidenceRow, EvidenceType } from "./evidence";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface GalleryItem {
  id: string;
  evidence_type: EvidenceType;
  storage_key: string | null;
  thumbnail_key: string | null;
  quote_text: string | null;
  quote_attribution: string | null;
  body: string | null;
  created_at: string;
  /* context */
  run_id: string;
  playdate_title: string | null;
  user_first_name: string;
}

export interface PendingGalleryItem extends GalleryItem {
  shared_to_gallery: boolean;
  gallery_approved: boolean;
  user_email: string;
}

/* ------------------------------------------------------------------ */
/*  public gallery — approved items only                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch approved gallery evidence with pagination.
 * Anonymous display: only first name of uploader.
 * Returns newest items first.
 */
export async function getGalleryEvidence(
  limit: number = 20,
  offset: number = 0,
): Promise<GalleryItem[]> {
  const result = await sql.query(
    `SELECT
       re.id, re.evidence_type,
       re.storage_key, re.thumbnail_key,
       re.quote_text, re.quote_attribution,
       re.body,
       re.created_at,
       r.id AS run_id,
       p.title AS playdate_title,
       COALESCE(
         NULLIF(u.name, ''),
         SPLIT_PART(u.email, '@', 1)
       ) AS user_first_name
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
     JOIN users u ON u.id = r.created_by
     WHERE re.shared_to_gallery = TRUE
       AND re.gallery_approved = TRUE
     ORDER BY re.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows as GalleryItem[];
}

/**
 * Count total approved gallery items.
 */
export async function countGalleryEvidence(): Promise<number> {
  const result = await sql.query(
    `SELECT COUNT(*)::int AS count
     FROM run_evidence
     WHERE shared_to_gallery = TRUE
       AND gallery_approved = TRUE`,
  );
  return result.rows[0]?.count ?? 0;
}

/* ------------------------------------------------------------------ */
/*  user gallery sharing controls                                     */
/* ------------------------------------------------------------------ */

/**
 * Mark evidence as shared to gallery (opt-in).
 * Caller must own the evidence's run.
 * Returns true if successful, false if not found or not authorized.
 */
export async function shareToGallery(
  evidenceId: string,
  session: CWSession,
): Promise<boolean> {
  // Look up evidence + verify ownership
  const lookup = await sql.query(
    `SELECT re.id, r.created_by
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     WHERE re.id = $1`,
    [evidenceId],
  );

  if (lookup.rows.length === 0) return false;
  if (!session.isAdmin && lookup.rows[0].created_by !== session.userId) {
    return false;
  }

  // Mark as shared (pending approval)
  await sql.query(
    `UPDATE run_evidence
     SET shared_to_gallery = TRUE, gallery_shared_at = NOW()
     WHERE id = $1`,
    [evidenceId],
  );

  return true;
}

/**
 * Remove evidence from gallery (opt-out).
 * Caller must own the evidence's run.
 * Returns true if successful, false if not found or not authorized.
 */
export async function unshareFromGallery(
  evidenceId: string,
  session: CWSession,
): Promise<boolean> {
  // Look up evidence + verify ownership
  const lookup = await sql.query(
    `SELECT re.id, r.created_by
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     WHERE re.id = $1`,
    [evidenceId],
  );

  if (lookup.rows.length === 0) return false;
  if (!session.isAdmin && lookup.rows[0].created_by !== session.userId) {
    return false;
  }

  // Remove from gallery and reset approval status
  await sql.query(
    `UPDATE run_evidence
     SET shared_to_gallery = FALSE, gallery_approved = FALSE
     WHERE id = $1`,
    [evidenceId],
  );

  return true;
}

/**
 * Check if a piece of evidence is currently shared to gallery.
 */
export async function isEvidenceSharedToGallery(
  evidenceId: string,
): Promise<boolean> {
  const result = await sql.query(
    `SELECT shared_to_gallery FROM run_evidence WHERE id = $1`,
    [evidenceId],
  );
  return result.rows[0]?.shared_to_gallery ?? false;
}

/* ------------------------------------------------------------------ */
/*  admin moderation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Approve a gallery item (admin-only).
 * Returns true if successful.
 */
export async function approveGalleryItem(
  evidenceId: string,
  session: CWSession,
): Promise<boolean> {
  if (!session.isAdmin) return false;

  // Verify the item exists and is shared
  const lookup = await sql.query(
    `SELECT id FROM run_evidence
     WHERE id = $1 AND shared_to_gallery = TRUE`,
    [evidenceId],
  );

  if (lookup.rows.length === 0) return false;

  await sql.query(
    `UPDATE run_evidence
     SET gallery_approved = TRUE
     WHERE id = $1`,
    [evidenceId],
  );

  return true;
}

/**
 * Reject/remove a gallery item from pending (admin-only).
 * Removes from gallery but does not delete the evidence.
 */
export async function rejectGalleryItem(
  evidenceId: string,
  session: CWSession,
): Promise<boolean> {
  if (!session.isAdmin) return false;

  // Verify the item exists
  const lookup = await sql.query(
    `SELECT id FROM run_evidence WHERE id = $1`,
    [evidenceId],
  );

  if (lookup.rows.length === 0) return false;

  await sql.query(
    `UPDATE run_evidence
     SET shared_to_gallery = FALSE, gallery_approved = FALSE
     WHERE id = $1`,
    [evidenceId],
  );

  return true;
}

/**
 * Get pending gallery items awaiting admin approval.
 * Admin-only query.
 * Returns newest pending items first.
 */
export async function getPendingGalleryItems(
  session: CWSession,
  limit: number = 50,
  offset: number = 0,
): Promise<PendingGalleryItem[]> {
  if (!session.isAdmin) return [];

  const result = await sql.query(
    `SELECT
       re.id, re.evidence_type,
       re.storage_key, re.thumbnail_key,
       re.quote_text, re.quote_attribution,
       re.body,
       re.created_at,
       re.shared_to_gallery,
       re.gallery_approved,
       r.id AS run_id,
       p.title AS playdate_title,
       COALESCE(
         NULLIF(u.name, ''),
         SPLIT_PART(u.email, '@', 1)
       ) AS user_first_name,
       u.email AS user_email
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
     JOIN users u ON u.id = r.created_by
     WHERE re.shared_to_gallery = TRUE
       AND re.gallery_approved = FALSE
     ORDER BY re.gallery_shared_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  return result.rows as PendingGalleryItem[];
}

/**
 * Count pending gallery items awaiting approval.
 */
export async function countPendingGalleryItems(
  session: CWSession,
): Promise<number> {
  if (!session.isAdmin) return 0;

  const result = await sql.query(
    `SELECT COUNT(*)::int AS count
     FROM run_evidence
     WHERE shared_to_gallery = TRUE
       AND gallery_approved = FALSE`,
  );
  return result.rows[0]?.count ?? 0;
}

/**
 * Get user's own gallery-shared evidence (both approved and pending).
 * Returns only evidence the user has explicitly shared.
 */
export async function getUserGalleryShares(
  userId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<Array<GalleryItem & { gallery_approved: boolean }>> {
  const result = await sql.query(
    `SELECT
       re.id, re.evidence_type,
       re.storage_key, re.thumbnail_key,
       re.quote_text, re.quote_attribution,
       re.body,
       re.created_at,
       re.gallery_approved,
       r.id AS run_id,
       p.title AS playdate_title,
       COALESCE(
         NULLIF(u.name, ''),
         SPLIT_PART(u.email, '@', 1)
       ) AS user_first_name
     FROM run_evidence re
     JOIN runs_cache r ON r.id = re.run_id
     LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
     JOIN users u ON u.id = r.created_by
     WHERE re.shared_to_gallery = TRUE
       AND r.created_by = $1
     ORDER BY re.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return result.rows as Array<GalleryItem & { gallery_approved: boolean }>;
}
