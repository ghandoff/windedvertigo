/**
 * Supabase read/write layer for `sounding_reviewers` — per-reviewer response
 * and reminder state for a sounding (see ./soundings.ts).
 *
 * Two design rules are enforced HERE, not in callers:
 *   - ONE reminder max: claimReminder() is a conditional update
 *     (… where reminded_at is null) — only the first concurrent caller wins,
 *     so a reviewer can never be nudged twice.
 *   - responded_at records the FIRST response and is never clobbered by
 *     later replies (markResponded only sets it when null).
 *
 * Same fail-open, snake_case-mapping style as ./agent-interventions.ts.
 */

import { supabase } from "./client";

export interface SoundingReviewerRow {
  id: string;
  soundingId: string;
  email: string;
  slackUserId: string | null;
  respondedAt: string | null;
  passedAt: string | null;
  remindedAt: string | null;
  createdAt: string;
}

function fromRow(row: Record<string, unknown>): SoundingReviewerRow {
  return {
    id: row.id as string,
    soundingId: row.sounding_id as string,
    email: row.email as string,
    slackUserId: (row.slack_user_id as string | null) ?? null,
    respondedAt: (row.responded_at as string | null) ?? null,
    passedAt: (row.passed_at as string | null) ?? null,
    remindedAt: (row.reminded_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Add reviewers to a sounding. Duplicate (sounding, email) pairs are ignored. */
export async function addReviewers(
  soundingId: string,
  reviewers: Array<{ email: string; slackUserId: string | null }>,
): Promise<void> {
  if (reviewers.length === 0) return;
  try {
    const { error } = await supabase
      .from("sounding_reviewers")
      .upsert(
        reviewers.map((r) => ({
          sounding_id: soundingId,
          email: r.email.toLowerCase(),
          slack_user_id: r.slackUserId,
        })),
        { onConflict: "sounding_id,email", ignoreDuplicates: true },
      );
    if (error) console.warn("[supabase/sounding-reviewers] addReviewers failed:", error.message);
  } catch (err) {
    console.warn(
      "[supabase/sounding-reviewers] addReviewers threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function listReviewers(soundingId: string): Promise<SoundingReviewerRow[]> {
  try {
    const { data, error } = await supabase
      .from("sounding_reviewers")
      .select("*")
      .eq("sounding_id", soundingId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[supabase/sounding-reviewers] list failed:", error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  } catch (err) {
    console.warn(
      "[supabase/sounding-reviewers] list threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Mark a reviewer as having responded. Matches by slack user id when known,
 * falling back to email. responded_at is only set on the FIRST response;
 * passed_at is set when the response was a 🙅 pass (a pass is a real,
 * penalty-free response — the digest reports it neutrally).
 */
export async function markResponded(
  soundingId: string,
  who: { email?: string | null; slackUserId?: string | null },
  opts: { passed: boolean },
): Promise<void> {
  try {
    let query = supabase
      .from("sounding_reviewers")
      .update({
        responded_at: new Date().toISOString(),
        ...(opts.passed ? { passed_at: new Date().toISOString() } : {}),
      })
      .eq("sounding_id", soundingId)
      .is("responded_at", null);
    if (who.slackUserId) {
      query = query.eq("slack_user_id", who.slackUserId);
    } else if (who.email) {
      query = query.eq("email", who.email.toLowerCase());
    } else {
      return; // nobody to match — replies from non-reviewers still become items
    }
    const { error } = await query;
    if (error) console.warn("[supabase/sounding-reviewers] markResponded failed:", error.message);
  } catch (err) {
    console.warn(
      "[supabase/sounding-reviewers] markResponded threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * ONE-reminder guard: atomically claim the right to send this reviewer their
 * single reminder. Returns true iff THIS call claimed it (reminded_at was
 * null). A DM failure after a won claim deliberately loses the reminder —
 * we fail toward silence, never toward a double nudge.
 */
export async function claimReminder(reviewerRowId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("sounding_reviewers")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", reviewerRowId)
      .is("reminded_at", null)
      .select("id");
    if (error) {
      console.warn("[supabase/sounding-reviewers] claimReminder failed:", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn(
      "[supabase/sounding-reviewers] claimReminder threw:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
