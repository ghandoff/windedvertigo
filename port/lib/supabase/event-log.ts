/**
 * Supabase read/write layer for event_log — the ambient-agent spine's raw
 * event ledger (docs/prompts/executive-agents-phase1-build.md §2.1).
 *
 * Phase 1 source is Slack channel messages only, written by
 * app/api/agent/slack/events/route.ts. The agent-ambient-sweep cron
 * (lib/agent/ambient-run.ts) reads unprocessed rows grouped by channel and
 * marks them processed once folded into an agent run.
 *
 * Same fail-open, snake_case-mapping style as ./agent-actions.ts.
 */

import { supabase } from "./client";

export interface EventLogEntry {
  source: "slack";
  type: string;
  channel: string;
  payload: Record<string, unknown>;
}

export interface EventLogRow {
  id: string;
  source: "slack";
  type: string;
  channel: string;
  payload: Record<string, unknown>;
  ts: string;
  processedAt: string | null;
}

function fromRow(row: Record<string, unknown>): EventLogRow {
  return {
    id: row.id as string,
    source: row.source as "slack",
    type: row.type as string,
    channel: row.channel as string,
    payload: row.payload as Record<string, unknown>,
    ts: row.ts as string,
    processedAt: (row.processed_at as string | null) ?? null,
  };
}

/** Fire-and-forget insert — the events route never blocks Slack's 3s ack on this. */
export async function insertEventLogRow(entry: EventLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from("event_log").insert({
      source: entry.source,
      type: entry.type,
      channel: entry.channel,
      payload: entry.payload,
    });
    if (error) {
      console.warn("[supabase/event-log] insert failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[supabase/event-log] insert threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Unprocessed rows across all watched channels, oldest first — the sweep's input. */
export async function listUnprocessedEvents(limit = 500): Promise<EventLogRow[]> {
  try {
    const { data, error } = await supabase
      .from("event_log")
      .select("*")
      .is("processed_at", null)
      .order("ts", { ascending: true })
      .limit(limit);
    if (error) {
      console.warn("[supabase/event-log] listUnprocessed failed:", error.message);
      return [];
    }
    return (data ?? []).map(fromRow);
  } catch (err) {
    console.warn(
      "[supabase/event-log] listUnprocessed threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Most recent event ts for a channel (processed or not) — used by the sweep's
 * quiet-window check ("no new rows in this channel for 2 ticks").
 */
export async function getLatestEventTs(channel: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("event_log")
      .select("ts")
      .eq("channel", channel)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.ts as string;
  } catch {
    return null;
  }
}

export async function markEventsProcessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const { error } = await supabase
      .from("event_log")
      .update({ processed_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      console.warn("[supabase/event-log] markProcessed failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[supabase/event-log] markProcessed threw:",
      err instanceof Error ? err.message : err,
    );
  }
}
