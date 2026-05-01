/**
 * GET /api/cron/sync-events-pilot
 *
 * One-way mirror: Notion events DB → Supabase `events` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
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
