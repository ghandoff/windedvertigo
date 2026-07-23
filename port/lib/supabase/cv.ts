/**
 * Supabase layer for collective_cv — CV currency tracking.
 *
 * Whitespace differentiator: none of the seven commercial RFP platforms scanned
 * (Responsive, Loopio, Qvidian, GovWin, etc.) treats CV currency as a
 * structured first-class gate. We do.
 *
 * One row per collective member. `last_verified_at` is bumped whenever the
 * member clicks "✓ My CV is current" (Slack interactive button or dashboard).
 * Rows older than `expires_after_days` (default 90) auto-trigger "verify your
 * CV" assignments when the member is named in a new proposal.
 */

import { supabase } from "./client";

export interface CollectiveCv {
  memberEmail: string;
  memberName: string;
  bio: string;
  lastVerifiedAt: string | null;
  notionPageId: string | null;
  expiresAfterDays: number;
  updatedAt: string;
}

interface CollectiveCvRow {
  member_email: string;
  member_name: string;
  bio: string;
  last_verified_at: string | null;
  notion_page_id: string | null;
  expires_after_days: number;
  updated_at: string;
}

const SELECT_COLS = "member_email, member_name, bio, last_verified_at, notion_page_id, expires_after_days, updated_at";

function rowToCv(row: CollectiveCvRow): CollectiveCv {
  return {
    memberEmail: row.member_email,
    memberName: row.member_name,
    bio: row.bio,
    lastVerifiedAt: row.last_verified_at,
    notionPageId: row.notion_page_id,
    expiresAfterDays: row.expires_after_days,
    updatedAt: row.updated_at,
  };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getAllCvs(): Promise<CollectiveCv[]> {
  const { data, error } = await supabase
    .from("collective_cv")
    .select(SELECT_COLS)
    .order("member_name");
  if (error) throw new Error(`[cv] getAll: ${error.message}`);
  return ((data ?? []) as unknown as CollectiveCvRow[]).map(rowToCv);
}

export async function getCvByEmail(email: string): Promise<CollectiveCv | null> {
  const { data, error } = await supabase
    .from("collective_cv")
    .select(SELECT_COLS)
    .eq("member_email", email)
    .maybeSingle();
  if (error) throw new Error(`[cv] getByEmail: ${error.message}`);
  return data ? rowToCv(data as unknown as CollectiveCvRow) : null;
}

/**
 * Returns true if the CV exists AND was verified within `expires_after_days`.
 * Used to decide whether to auto-create a "verify your CV" assignment when
 * naming this contributor in a new proposal.
 */
export async function isCvCurrent(email: string): Promise<boolean> {
  const cv = await getCvByEmail(email);
  if (!cv?.lastVerifiedAt) return false;
  const ageMs = Date.now() - new Date(cv.lastVerifiedAt).getTime();
  const expiryMs = cv.expiresAfterDays * 24 * 3600 * 1000;
  return ageMs < expiryMs;
}

/**
 * Three-tier confidence for BIZ-Q1 CV claim verification.
 *
 *   verified     — last_verified_at exists and is within expires_after_days
 *   needs-review — last_verified_at exists but has expired
 *   draft        — last_verified_at has never been set
 *
 * Returns null when the member is not found in collective_cv.
 */
export type CvConfidence = "verified" | "needs-review" | "draft";

export function cvConfidence(cv: CollectiveCv): CvConfidence {
  if (!cv.lastVerifiedAt) return "draft";
  const ageMs = Date.now() - new Date(cv.lastVerifiedAt).getTime();
  const expiryMs = cv.expiresAfterDays * 24 * 3600 * 1000;
  return ageMs < expiryMs ? "verified" : "needs-review";
}

export async function getCvConfidence(email: string): Promise<CvConfidence | null> {
  const cv = await getCvByEmail(email);
  if (!cv) return null;
  return cvConfidence(cv);
}

// ── Write ────────────────────────────────────────────────────────────────────

export interface UpsertCv {
  memberEmail: string;
  memberName: string;
  bio: string;
  notionPageId?: string | null;
  expiresAfterDays?: number;
}

export async function upsertCv(cv: UpsertCv): Promise<CollectiveCv> {
  const { data, error } = await supabase
    .from("collective_cv")
    .upsert(
      {
        member_email:       cv.memberEmail,
        member_name:        cv.memberName,
        bio:                cv.bio,
        notion_page_id:     cv.notionPageId ?? null,
        expires_after_days: cv.expiresAfterDays ?? 90,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: "member_email" },
    )
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`[cv] upsert: ${error.message}`);
  return rowToCv(data as unknown as CollectiveCvRow);
}

/** Bump last_verified_at — called when the member confirms via Slack button or dashboard. */
export async function markCvVerified(email: string): Promise<void> {
  const { error } = await supabase
    .from("collective_cv")
    .update({ last_verified_at: new Date().toISOString() })
    .eq("member_email", email);
  if (error) throw new Error(`[cv] markVerified: ${error.message}`);
}
