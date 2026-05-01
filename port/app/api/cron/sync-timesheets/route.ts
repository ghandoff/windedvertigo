/**
 * GET /api/cron/sync-timesheets
 *
 * One-way mirror: Notion timesheets DB → Supabase `timesheets` table.
 * Runs every 4 hours. Upserts on notion_page_id (idempotent).
 * Notion stays authoritative for writes; Supabase is read-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllTimesheets } from "@/lib/notion/timesheets";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const timesheets = await getAllTimesheets();

  if (timesheets.length === 0) {
    return NextResponse.json({ message: "no timesheets found", upserted: 0 });
  }

  const rows = timesheets.map((t) => ({
    notion_page_id: t.id,
    entry:          t.entry ?? "",
    person_ids:     t.personIds ?? [],
    date_start:     t.dateAndTime?.start ?? null,
    date_end:       t.dateAndTime?.end ?? null,
    hours:          t.hours ?? null,
    minutes:        t.minutes ?? null,
    status:         t.status ?? null,
    type:           t.type ?? null,
    task_ids:       t.taskIds ?? [],
    meeting_ids:    t.meetingIds ?? [],
    billable:       t.billable ?? false,
    rate:           t.rate ?? null,
    amount:         t.amount ?? null,
    explanation:    t.explanation ?? "",
    updated_at:     new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("timesheets")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-timesheets] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} timesheets to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
