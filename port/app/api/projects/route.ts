/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */

import { NextRequest } from "next/server";
import {
  getProjectsFromSupabase,
  upsertProjectToSupabase,
  type ProjectSupabaseFilters,
} from "@/lib/supabase/projects";
import { json, error, param, boolParam } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: ProjectSupabaseFilters = {};
  if (param(req, "status"))   filters.status   = param(req, "status");
  if (param(req, "priority")) filters.priority = param(req, "priority");
  if (param(req, "type"))     filters.type     = param(req, "type");
  if (param(req, "search"))   filters.search   = param(req, "search");
  if (boolParam(req, "archive") !== undefined) filters.archive = boolParam(req, "archive");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getProjectsFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/projects] Supabase query failed:", err);
    return error("failed to load projects", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project) return error("project (name) is required");

  try {
    const id = crypto.randomUUID();
    await upsertProjectToSupabase(id, {
      project: body.project,
      status: body.status ?? "planning",
      priority: body.priority ?? "medium",
      type: body.type ?? null,
      budget_hours: body.budgetHours ?? null,
      event_type: body.eventType ?? null,
      timeline_start: body.timeline?.start ?? null,
      timeline_end: body.timeline?.end ?? null,
      project_lead_ids: body.projectLeadIds ?? [],
      organization_ids: body.organizationIds ?? [],
      milestone_ids: body.milestoneIds ?? [],
      task_ids: body.taskIds ?? [],
      cycle_ids: body.cycleIds ?? [],
      archive: false,
    });

    return json({
      id,
      project: body.project,
      status: body.status ?? "planning",
      priority: body.priority ?? "medium",
      type: body.type ?? null,
      budgetHours: body.budgetHours ?? null,
      eventType: body.eventType ?? "",
      timeline: body.timeline ?? null,
      dateAndTime: null,
      projectLeadIds: body.projectLeadIds ?? [],
      organizationIds: body.organizationIds ?? [],
      milestoneIds: body.milestoneIds ?? [],
      taskIds: body.taskIds ?? [],
      cycleIds: body.cycleIds ?? [],
      archive: false,
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/projects] POST failed:", err);
    return error("failed to create project", 500);
  }
}
