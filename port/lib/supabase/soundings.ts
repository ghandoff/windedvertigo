/**
 * Supabase read/write layer for the `soundings` table — phase 1 "sounding
 * board" feedback requests (one row per slack thread collecting voice-note /
 * text / pass feedback on an RFP one-pager or a manually-shared doc).
 *
 * Lifecycle: open → digested (digest posted) → closed (human), or
 * open → expired (deadline passed with zero notes — graceful, no shame).
 * The open→digested and open→expired transitions are CLAIMS — conditional
 * updates that only one concurrent caller can win — so the sweep cron and an
 * early all-responded digest can never double-post.
 *
 * Same fail-open, snake_case-mapping style as ./agent-interventions.ts.
 */

import { supabase } from "./client";

export type SoundingStatus = "open" | "digested" | "closed" | "expired";
export type SoundingSource = "rfp" | "manual";

export interface SoundingQuestion {
  text: string;
  /** provenance — rendered as 👤 (human) vs 🤖 (agent) in the kickoff post */
  askedByType: "human" | "agent";
  askedByName: string;
}

export interface SoundingDigestJson {
  themes: string[];
  conflicts: string[];
  actions: Array<{ section: string; action: string }>;
}

export interface SoundingEntry {
  source: SoundingSource;
  rfpNotionPageId?: string | null;
  docTitle: string;
  docUrl?: string | null;
  slackChannelId: string;
  slackThreadTs: string;
  questions: SoundingQuestion[];
  deadlineAt: string; // ISO
  createdBy?: string | null;
}

export interface SoundingRow {
  id: string;
  source: SoundingSource;
  rfpNotionPageId: string | null;
  docTitle: string;
  docUrl: string | null;
  slackChannelId: string;
  slackThreadTs: string;
  kickoffMsgTs: string | null;
  questions: SoundingQuestion[];
  status: SoundingStatus;
  deadlineAt: string;
  digestedAt: string | null;
  digestJson: SoundingDigestJson | null;
  digestPostedTs: string | null;
  closedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

function fromRow(row: Record<string, unknown>): SoundingRow {
  return {
    id: row.id as string,
    source: row.source as SoundingSource,
    rfpNotionPageId: (row.rfp_notion_page_id as string | null) ?? null,
    docTitle: row.doc_title as string,
    docUrl: (row.doc_url as string | null) ?? null,
    slackChannelId: row.slack_channel_id as string,
    slackThreadTs: row.slack_thread_ts as string,
    kickoffMsgTs: (row.kickoff_msg_ts as string | null) ?? null,
    questions: (row.questions as SoundingQuestion[] | null) ?? [],
    status: row.status as SoundingStatus,
    deadlineAt: row.deadline_at as string,
    digestedAt: (row.digested_at as string | null) ?? null,
    digestJson: (row.digest_json as SoundingDigestJson | null) ?? null,
    digestPostedTs: (row.digest_posted_ts as string | null) ?? null,
    closedAt: (row.closed_at as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Insert a new sounding. Fails open — logs and returns null on error
 *  (including a unique-index conflict when a sounding already exists for the
 *  thread, which callers should treat as "already created"). */
export async function insertSounding(entry: SoundingEntry): Promise<SoundingRow | null> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .insert({
        source:             entry.source,
        rfp_notion_page_id: entry.rfpNotionPageId ?? null,
        doc_title:          entry.docTitle,
        doc_url:            entry.docUrl ?? null,
        slack_channel_id:   entry.slackChannelId,
        slack_thread_ts:    entry.slackThreadTs,
        questions:          entry.questions.map((q) => ({
          text: q.text,
          asked_by_type: q.askedByType,
          asked_by_name: q.askedByName,
        })),
        deadline_at:        entry.deadlineAt,
        created_by:         entry.createdBy ?? null,
      })
      .select()
      .single();
    if (error) {
      console.warn("[supabase/soundings] insert failed:", error.message);
      return null;
    }
    return fromRow({ ...data, questions: entry.questions });
  } catch (err) {
    console.warn("[supabase/soundings] insert threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Map the snake_case question shape stored in jsonb back to the TS shape. */
function mapQuestions(row: Record<string, unknown>): SoundingRow {
  const mapped = fromRow(row);
  mapped.questions = ((row.questions as Array<Record<string, unknown>> | null) ?? []).map((q) => ({
    text: (q.text as string) ?? "",
    askedByType: ((q.asked_by_type ?? q.askedByType) as "human" | "agent") ?? "human",
    askedByName: ((q.asked_by_name ?? q.askedByName) as string) ?? "",
  }));
  return mapped;
}

export async function getSoundingByThread(
  channelId: string,
  threadTs: string,
): Promise<SoundingRow | null> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .select("*")
      .eq("slack_channel_id", channelId)
      .eq("slack_thread_ts", threadTs)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn("[supabase/soundings] getByThread failed:", error.message);
      return null;
    }
    return mapQuestions(data);
  } catch (err) {
    console.warn("[supabase/soundings] getByThread threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getSoundingById(id: string): Promise<SoundingRow | null> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn("[supabase/soundings] getById failed:", error.message);
      return null;
    }
    return mapQuestions(data);
  } catch (err) {
    console.warn("[supabase/soundings] getById threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Open sounding for an RFP, if any — the re-defer idempotency check. */
export async function getOpenSoundingForRfp(notionPageId: string): Promise<SoundingRow | null> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .select("*")
      .eq("rfp_notion_page_id", notionPageId)
      .eq("status", "open")
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn("[supabase/soundings] getOpenForRfp failed:", error.message);
      return null;
    }
    return mapQuestions(data);
  } catch (err) {
    console.warn("[supabase/soundings] getOpenForRfp threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** All open soundings — the sweep cron's input. */
export async function listOpenSoundings(): Promise<SoundingRow[]> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .select("*")
      .eq("status", "open")
      .order("deadline_at", { ascending: true });
    if (error) {
      console.warn("[supabase/soundings] listOpen failed:", error.message);
      return [];
    }
    return (data ?? []).map(mapQuestions);
  } catch (err) {
    console.warn("[supabase/soundings] listOpen threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Digested soundings whose digest post failed after the claim (repair path),
 *  plus digested soundings past the grace window (auto-close path). */
export async function listDigestedSoundings(): Promise<SoundingRow[]> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .select("*")
      .eq("status", "digested")
      .order("digested_at", { ascending: true });
    if (error) {
      console.warn("[supabase/soundings] listDigested failed:", error.message);
      return [];
    }
    return (data ?? []).map(mapQuestions);
  } catch (err) {
    console.warn("[supabase/soundings] listDigested threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function listSoundings(limit = 50): Promise<SoundingRow[]> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[supabase/soundings] list failed:", error.message);
      return [];
    }
    return (data ?? []).map(mapQuestions);
  } catch (err) {
    console.warn("[supabase/soundings] list threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Atomic open→digested claim. Returns true iff THIS caller won the claim
 * (the conditional update matched a row) — only the winner posts the digest,
 * so an early all-responded digest and the deadline sweep can't double-post.
 */
export async function claimDigest(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .update({ status: "digested", digested_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "open")
      .select("id");
    if (error) {
      console.warn("[supabase/soundings] claimDigest failed:", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn("[supabase/soundings] claimDigest threw:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Store the generated digest + the slack ts of the posted reply. */
export async function setDigestPosted(
  id: string,
  digestJson: SoundingDigestJson | null,
  postedTs: string | null,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("soundings")
      .update({ digest_json: digestJson, digest_posted_ts: postedTs })
      .eq("id", id);
    if (error) console.warn("[supabase/soundings] setDigestPosted failed:", error.message);
  } catch (err) {
    console.warn("[supabase/soundings] setDigestPosted threw:", err instanceof Error ? err.message : err);
  }
}

/** Record the kickoff thread reply's ts (audit; also lets capture skip it). */
export async function setKickoffMsgTs(id: string, ts: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("soundings")
      .update({ kickoff_msg_ts: ts })
      .eq("id", id);
    if (error) console.warn("[supabase/soundings] setKickoffMsgTs failed:", error.message);
  } catch (err) {
    console.warn("[supabase/soundings] setKickoffMsgTs threw:", err instanceof Error ? err.message : err);
  }
}

/** Atomic open→expired claim (deadline passed, zero notes). Same win semantics as claimDigest. */
export async function expireSounding(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .update({ status: "expired", closed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "open")
      .select("id");
    if (error) {
      console.warn("[supabase/soundings] expire failed:", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn("[supabase/soundings] expire threw:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** digested→closed (human close, or the sweep's grace-window auto-close). */
export async function closeSounding(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("soundings")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "digested")
      .select("id");
    if (error) {
      console.warn("[supabase/soundings] close failed:", error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn("[supabase/soundings] close threw:", err instanceof Error ? err.message : err);
    return false;
  }
}
