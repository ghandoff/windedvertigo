/**
 * Supabase read/write layer for `sounding_items` — one row per captured
 * feedback reply (voice note / text / pass) on a sounding (see ./soundings.ts).
 *
 * Design rules enforced HERE:
 *   - Idempotent capture: insertItem() upserts on the
 *     (sounding_id, slack_user_id, slack_msg_ts) unique key and reports
 *     whether a row was actually created — slack's at-least-once event
 *     delivery and the cron catch-up sweep can both call it safely.
 *   - Terminal states: only `new` items may move to integrated/declined
 *     (guarded with .eq("status","new")); expired is set by the sweep.
 *   - declined REQUIRES a non-empty reason — validated here before the DB
 *     CHECK ever sees it, so callers get a clean error message.
 *
 * Same fail-open, snake_case-mapping style as ./agent-interventions.ts.
 */

import { supabase } from "./client";

export type SoundingItemKind = "voice" | "text" | "pass";
export type SoundingItemStatus = "new" | "integrated" | "declined" | "expired";
export type TranscriptStatus = "pending" | "done" | "failed";

export interface SoundingItemEntry {
  soundingId: string;
  slackUserId: string;
  reviewerEmail?: string | null;
  kind: SoundingItemKind;
  slackMsgTs: string;
  slackFileId?: string | null;
  audioR2Key?: string | null;
  audioR2Url?: string | null;
  audioContentType?: string | null;
  textBody?: string | null;
  transcript?: string | null;
  transcriptStatus?: TranscriptStatus;
  transcriptError?: string | null;
}

export interface SoundingItemRow {
  id: string;
  soundingId: string;
  slackUserId: string;
  reviewerEmail: string | null;
  kind: SoundingItemKind;
  slackMsgTs: string;
  slackFileId: string | null;
  audioR2Key: string | null;
  audioR2Url: string | null;
  audioContentType: string | null;
  textBody: string | null;
  transcript: string | null;
  transcriptStatus: TranscriptStatus;
  transcriptError: string | null;
  status: SoundingItemStatus;
  statusReason: string | null;
  statusSetBy: string | null;
  statusSetAt: string | null;
  receiptSentAt: string | null;
  createdAt: string;
}

function fromRow(row: Record<string, unknown>): SoundingItemRow {
  return {
    id: row.id as string,
    soundingId: row.sounding_id as string,
    slackUserId: row.slack_user_id as string,
    reviewerEmail: (row.reviewer_email as string | null) ?? null,
    kind: row.kind as SoundingItemKind,
    slackMsgTs: row.slack_msg_ts as string,
    slackFileId: (row.slack_file_id as string | null) ?? null,
    audioR2Key: (row.audio_r2_key as string | null) ?? null,
    audioR2Url: (row.audio_r2_url as string | null) ?? null,
    audioContentType: (row.audio_content_type as string | null) ?? null,
    textBody: (row.text_body as string | null) ?? null,
    transcript: (row.transcript as string | null) ?? null,
    transcriptStatus: row.transcript_status as TranscriptStatus,
    transcriptError: (row.transcript_error as string | null) ?? null,
    status: row.status as SoundingItemStatus,
    statusReason: (row.status_reason as string | null) ?? null,
    statusSetBy: (row.status_set_by as string | null) ?? null,
    statusSetAt: (row.status_set_at as string | null) ?? null,
    receiptSentAt: (row.receipt_sent_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Insert-if-absent on the (sounding_id, slack_user_id, slack_msg_ts) unique
 * key. `created: false` means the row already existed (a slack retry or the
 * catch-up sweep racing the events route) — the caller should stop, another
 * path already owns the slow work.
 */
export async function insertItem(
  entry: SoundingItemEntry,
): Promise<{ row: SoundingItemRow | null; created: boolean }> {
  try {
    const { data, error } = await supabase
      .from("sounding_items")
      .upsert(
        {
          sounding_id:        entry.soundingId,
          slack_user_id:      entry.slackUserId,
          reviewer_email:     entry.reviewerEmail?.toLowerCase() ?? null,
          kind:               entry.kind,
          slack_msg_ts:       entry.slackMsgTs,
          slack_file_id:      entry.slackFileId ?? null,
          audio_r2_key:       entry.audioR2Key ?? null,
          audio_r2_url:       entry.audioR2Url ?? null,
          audio_content_type: entry.audioContentType ?? null,
          text_body:          entry.textBody ?? null,
          transcript:         entry.transcript ?? null,
          transcript_status:  entry.transcriptStatus ?? "done",
          transcript_error:   entry.transcriptError ?? null,
        },
        { onConflict: "sounding_id,slack_user_id,slack_msg_ts", ignoreDuplicates: true },
      )
      .select();
    if (error) {
      console.warn("[supabase/sounding-items] insert failed:", error.message);
      return { row: null, created: false };
    }
    // ignoreDuplicates returns [] when the row already existed.
    if (!data || data.length === 0) return { row: null, created: false };
    return { row: fromRow(data[0]), created: true };
  } catch (err) {
    console.warn("[supabase/sounding-items] insert threw:", err instanceof Error ? err.message : err);
    return { row: null, created: false };
  }
}

export async function listItems(soundingId: string): Promise<SoundingItemRow[]> {
  try {
    const { data, error } = await supabase
      .from("sounding_items")
      .select("*")
      .eq("sounding_id", soundingId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[supabase/sounding-items] list failed:", error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  } catch (err) {
    console.warn("[supabase/sounding-items] list threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getItem(id: string): Promise<SoundingItemRow | null> {
  try {
    const { data, error } = await supabase
      .from("sounding_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn("[supabase/sounding-items] get failed:", error.message);
      return null;
    }
    return fromRow(data);
  } catch (err) {
    console.warn("[supabase/sounding-items] get threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Latest captured reply ts for a sounding — the catch-up sweep's `oldest` cursor. */
export async function latestItemTs(soundingId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("sounding_items")
      .select("slack_msg_ts")
      .eq("sounding_id", soundingId)
      .order("slack_msg_ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn("[supabase/sounding-items] latestItemTs failed:", error.message);
      return null;
    }
    return (data.slack_msg_ts as string) ?? null;
  } catch (err) {
    console.warn("[supabase/sounding-items] latestItemTs threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Voice items whose transcription is pending or failed — the sweep's retry input. */
export async function listPendingTranscripts(soundingId: string): Promise<SoundingItemRow[]> {
  try {
    const { data, error } = await supabase
      .from("sounding_items")
      .select("*")
      .eq("sounding_id", soundingId)
      .eq("kind", "voice")
      .in("transcript_status", ["pending", "failed"]);
    if (error) {
      console.warn("[supabase/sounding-items] listPendingTranscripts failed:", error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  } catch (err) {
    console.warn(
      "[supabase/sounding-items] listPendingTranscripts threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function setTranscript(
  id: string,
  result: { transcript?: string | null; status: "done" | "failed"; error?: string | null },
): Promise<void> {
  try {
    const { error } = await supabase
      .from("sounding_items")
      .update({
        transcript: result.transcript ?? null,
        transcript_status: result.status,
        transcript_error: result.error ?? null,
      })
      .eq("id", id);
    if (error) console.warn("[supabase/sounding-items] setTranscript failed:", error.message);
  } catch (err) {
    console.warn("[supabase/sounding-items] setTranscript threw:", err instanceof Error ? err.message : err);
  }
}

/** Record where the audio landed in R2 (set after the pending-claim insert). */
export async function setItemAudio(
  id: string,
  audio: { r2Key: string; r2Url: string; contentType: string },
): Promise<void> {
  try {
    const { error } = await supabase
      .from("sounding_items")
      .update({
        audio_r2_key: audio.r2Key,
        audio_r2_url: audio.r2Url,
        audio_content_type: audio.contentType,
      })
      .eq("id", id);
    if (error) console.warn("[supabase/sounding-items] setItemAudio failed:", error.message);
  } catch (err) {
    console.warn("[supabase/sounding-items] setItemAudio threw:", err instanceof Error ? err.message : err);
  }
}

/**
 * Human triage: move a `new` item to a terminal state.
 * `declined` REQUIRES a non-empty reason — throws with a clean message before
 * the DB CHECK ever fires. `integrated` may carry an optional "what changed"
 * note in the same column. Returns the updated row, or null if the item
 * wasn't in `new` (already triaged — first click wins).
 */
export async function setItemStatus(
  id: string,
  status: "integrated" | "declined",
  opts: { reason?: string; setBy: string },
): Promise<SoundingItemRow | null> {
  if (status === "declined" && !opts.reason?.trim()) {
    throw new Error("[supabase/sounding-items] declined requires a non-empty reason");
  }
  try {
    const { data, error } = await supabase
      .from("sounding_items")
      .update({
        status,
        status_reason: opts.reason?.trim() || null,
        status_set_by: opts.setBy.toLowerCase(),
        status_set_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "new") // terminal states are immutable — first triage wins
      .select();
    if (error) {
      console.warn("[supabase/sounding-items] setItemStatus failed:", error.message);
      return null;
    }
    if (!data || data.length === 0) return null;
    return fromRow(data[0]);
  } catch (err) {
    console.warn("[supabase/sounding-items] setItemStatus threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** new→expired for all untriaged items of a sounding (close/expiry path).
 *  Expired items never get receipts — no guilt residue for anyone. */
export async function expireNewItems(soundingId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("sounding_items")
      .update({ status: "expired", status_set_at: new Date().toISOString() })
      .eq("sounding_id", soundingId)
      .eq("status", "new");
    if (error) console.warn("[supabase/sounding-items] expireNewItems failed:", error.message);
  } catch (err) {
    console.warn("[supabase/sounding-items] expireNewItems threw:", err instanceof Error ? err.message : err);
  }
}

/** Terminal (integrated/declined) items whose receipt DM hasn't been sent. */
export async function listReceiptDue(): Promise<SoundingItemRow[]> {
  try {
    const { data, error } = await supabase
      .from("sounding_items")
      .select("*")
      .in("status", ["integrated", "declined"])
      .is("receipt_sent_at", null);
    if (error) {
      console.warn("[supabase/sounding-items] listReceiptDue failed:", error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  } catch (err) {
    console.warn("[supabase/sounding-items] listReceiptDue threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Mark a receipt as sent — only called AFTER the DM actually succeeded. */
export async function markReceiptSent(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("sounding_items")
      .update({ receipt_sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.warn("[supabase/sounding-items] markReceiptSent failed:", error.message);
  } catch (err) {
    console.warn("[supabase/sounding-items] markReceiptSent threw:", err instanceof Error ? err.message : err);
  }
}
