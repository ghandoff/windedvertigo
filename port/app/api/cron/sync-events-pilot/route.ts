/**
 * GET /api/cron/sync-events-pilot
 *
 * Daily safety-net mirror: Notion events DB → Supabase `crm_events` table.
 *
 * Status: BACKSTOP (formerly RETIRED in Phase A4 cleanup).
 * Restored 2026-05-07 after the events tab went blank — `crm_events` had 0
 * rows because Phase A4 retired this mirror without a final backfill of
 * the existing 42-conference Notion DB. The cron only UPSERTS (never
 * deletes), so port-UI edits made between runs are not clobbered as long
 * as nobody edits the same row in Notion concurrently.
 *
 * Retire this once: (a) the team works exclusively from the port UI, AND
 * (b) the discovery feeds (org-affiliated scout, newsletter scan, manual
 * paste) have been live and producing fresh candidates for ≥4 weeks.
 *
 * Runs daily at 07:00 UTC via lib/scheduled.ts CRON_TABLE.
 * Auth: Authorization: Bearer {CRON_SECRET}.
 * Upserts on notion_page_id (idempotent).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllEvents } from "@/lib/notion/events";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await getAllEvents();

  if (events.length === 0) {
    return NextResponse.json({ message: "no events to sync", upserted: 0, total: 0 });
  }

  const rows = events.map((e) => ({
    notion_page_id: e.id,
    event: e.event,
    type: e.type ?? null,
    event_start: e.eventDates?.start ?? null,
    event_end: e.eventDates?.end ?? null,
    proposal_deadline: e.proposalDeadline?.start ?? null,
    frequency: e.frequency ?? null,
    location: e.location ?? null,
    est_attendance: e.estAttendance ?? null,
    registration_cost: e.registrationCost ?? null,
    quadrant_relevance: e.quadrantRelevance ?? [],
    bd_segments: e.bdSegments ?? null,
    who_should_attend: e.whoShouldAttend ?? [],
    why_it_matters: e.whyItMatters ?? null,
    notes: e.notes ?? null,
    url: e.url ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("crm_events")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-events-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} events to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
