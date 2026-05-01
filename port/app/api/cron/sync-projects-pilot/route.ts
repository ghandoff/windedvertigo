/**
 * GET /api/cron/sync-projects-pilot
 *
 * One-way mirror: Notion projects DB → Supabase `projects` table.
 * Runs every 15 minutes. Upserts on notion_page_id (idempotent).
 * Syncs all rows including archived so the Supabase table is a complete replica.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllProjects } from "@/lib/notion/projects";
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

  const projects = await getAllProjects();

  if (projects.length === 0) {
    return NextResponse.json({ message: "no projects to sync", upserted: 0, total: 0 });
  }

  const rows = projects.map((p) => ({
    notion_page_id: p.id,
    project: p.project,
    status: p.status ?? null,
    priority: p.priority ?? null,
    type: p.type ?? null,
    budget_hours: p.budgetHours ?? null,
    event_type: p.eventType ?? null,
    timeline_start: p.timeline?.start ?? null,
    timeline_end: p.timeline?.end ?? null,
    project_lead_ids: p.projectLeadIds ?? [],
    organization_ids: p.organizationIds ?? [],
    milestone_ids: p.milestoneIds ?? [],
    task_ids: p.taskIds ?? [],
    cycle_ids: p.cycleIds ?? [],
    archive: p.archive ?? false,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("projects")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-projects-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} projects to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
