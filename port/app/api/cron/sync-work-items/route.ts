/**
 * GET /api/cron/sync-work-items
 *
 * One-way mirror: Notion work_items DB → Supabase `work_items` table.
 * Runs every 2 hours. Upserts on notion_page_id (idempotent).
 * Notion stays authoritative for writes; Supabase is read-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllWorkItems } from "@/lib/notion/work-items";
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

  const workItems = await getAllWorkItems();

  if (workItems.length === 0) {
    return NextResponse.json({ message: "no work items found", upserted: 0 });
  }

  const rows = workItems.map((w) => ({
    notion_page_id:  w.id,
    task:            w.task ?? "",
    status:          w.status ?? null,
    task_type:       w.taskType ?? null,
    priority:        w.priority ?? null,
    owner_ids:       w.ownerIds ?? [],
    person_ids:      w.personIds ?? [],
    project_ids:     w.projectIds ?? [],
    milestone_ids:   w.milestoneIds ?? [],
    parent_task_ids: w.parentTaskIds ?? [],
    sub_task_ids:    w.subTaskIds ?? [],
    blocking_ids:    w.blockingIds ?? [],
    blocked_by_ids:  w.blockedByIds ?? [],
    timesheet_ids:   w.timesheetIds ?? [],
    meeting_ids:     w.meetingIds ?? [],
    due_date:        w.dueDate?.start ?? null,
    estimate_hours:  w.estimateHours ?? null,
    archive:         w.archive ?? false,
    updated_at:      new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("work_items")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-work-items] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} work items to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
