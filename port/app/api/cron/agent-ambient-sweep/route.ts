/**
 * GET /api/cron/agent-ambient-sweep
 *
 * Runs every 5 minutes (lib/scheduled.ts FIVE_MINUTE_PATHS). Reads
 * unprocessed event_log rows, groups by channel, applies the debounce
 * (docs/prompts/executive-agents-phase1-build.md §2.1: "buffer Slack
 * messages per channel; invoke agents on conversation lulls (10 min quiet)
 * or high-signal events"), and fans qualifying batches to both Mo and PaM's
 * ambient judgment pass — each agent's own charter-aware prefilter decides
 * relevance, so routing every watched-channel batch to both is simpler than
 * pre-filtering by keyword outside the model, and the cheap Haiku prefilter
 * keeps the false-positive cost low (spec §3 cost guard).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listUnprocessedEvents,
  markEventsProcessed,
  type EventLogRow,
} from "@/lib/supabase/event-log";
import { runAmbientAgentPass } from "@/lib/agent/ambient-run";

export const maxDuration = 60;

const QUIET_WINDOW_MS = 10 * 60 * 1000;
// Charter-cited trigger words (Mo: "submitted"/"signed"/"launched"; PaM: "I'll
// … by …" promises) — short-circuits the quiet-window wait for high-signal
// events so a win-event doesn't sit buffered for 10 minutes.
const HIGH_SIGNAL = /\b(submitted|signed|launched)\b|\bi'?ll\b.{0,60}\bby\b/i;

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

function groupByChannel(rows: EventLogRow[]): Map<string, EventLogRow[]> {
  const groups = new Map<string, EventLogRow[]>();
  for (const row of rows) {
    if (!groups.has(row.channel)) groups.set(row.channel, []);
    groups.get(row.channel)!.push(row);
  }
  return groups;
}

function batchReady(batch: EventLogRow[]): boolean {
  const hasHighSignal = batch.some((e) =>
    HIGH_SIGNAL.test((e.payload as { text?: string }).text ?? ""),
  );
  if (hasHighSignal) return true;

  const newestTs = Math.max(...batch.map((e) => new Date(e.ts).getTime()));
  return Date.now() - newestTs >= QUIET_WINDOW_MS;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const unprocessed = await listUnprocessedEvents();
  const byChannel = groupByChannel(unprocessed);

  let batchesRun = 0;
  let eventsProcessed = 0;

  for (const [, batch] of byChannel) {
    if (!batchReady(batch)) continue; // still buffering — wait for the next tick

    await Promise.all([
      runAmbientAgentPass("mo", batch),
      runAmbientAgentPass("pam", batch),
    ]);
    await markEventsProcessed(batch.map((e) => e.id));

    batchesRun += 1;
    eventsProcessed += batch.length;
  }

  return NextResponse.json({ channelsSeen: byChannel.size, batchesRun, eventsProcessed });
}
