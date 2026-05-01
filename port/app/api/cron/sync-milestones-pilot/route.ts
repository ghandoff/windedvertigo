/**
 * GET /api/cron/sync-milestones-pilot
 *
 * One-way mirror: Notion milestones DB → Supabase `milestones` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * Syncs all rows including archived so the Supabase table is a complete replica.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllMilestones } from "@/lib/notion/milestones";
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

  const milestones = await getAllMilestones();

  if (milestones.length === 0) {
    return NextResponse.json({ message: "no milestones to sync", upserted: 0, total: 0 });
  }

  const rows = milestones.map((m) => ({
    notion_page_id: m.id,
    milestone: m.milestone,
    kind: m.kind ?? "milestone",
    milestone_status: m.milestoneStatus ?? "not started",
    project_ids: m.projectIds ?? [],
    task_ids: m.taskIds ?? [],
    owner_ids: m.ownerIds ?? [],
    start_date: m.startDate ?? null,
    end_date: m.endDate ?? null,
    client_visible: m.clientVisible ?? false,
    description: m.description ?? null,
    brief: m.brief ?? null,
    billing_total: m.billingTotal ?? null,
    archive: m.archive ?? false,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("milestones")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-milestones-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} milestones to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
