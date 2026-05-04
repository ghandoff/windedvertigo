/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */

import { NextRequest } from "next/server";
import {
  getMilestonesFromSupabase,
  upsertMilestoneToSupabase,
  type MilestoneSupabaseFilters,
} from "@/lib/supabase/milestones";
import { json, error, param, boolParam } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: MilestoneSupabaseFilters = {};
  if (param(req, "kind"))            filters.kind            = param(req, "kind");
  if (param(req, "milestoneStatus")) filters.milestoneStatus = param(req, "milestoneStatus");
  if (param(req, "projectId"))       filters.projectId       = param(req, "projectId");
  if (param(req, "search"))          filters.search          = param(req, "search");
  if (boolParam(req, "clientVisible") !== undefined)   filters.clientVisible   = boolParam(req, "clientVisible");
  if (boolParam(req, "includeArchived") !== undefined) filters.includeArchived = boolParam(req, "includeArchived");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getMilestonesFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/milestones] Supabase query failed:", err);
    return error("failed to load milestones", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.milestone) return error("milestone (name) is required");

  try {
    const id = crypto.randomUUID();
    await upsertMilestoneToSupabase(id, {
      milestone: body.milestone,
      kind: body.kind ?? "milestone",
      milestone_status: body.milestoneStatus ?? "not started",
      project_ids: body.projectIds ?? [],
      task_ids: body.taskIds ?? [],
      owner_ids: body.ownerIds ?? [],
      start_date: body.startDate ?? null,
      end_date: body.endDate ?? null,
      client_visible: body.clientVisible ?? false,
      description: body.description ?? null,
      brief: body.brief ?? null,
      billing_total: body.billingTotal ?? null,
      archive: false,
    });

    return json({
      id,
      milestone: body.milestone,
      kind: body.kind ?? "milestone",
      milestoneStatus: body.milestoneStatus ?? "not started",
      projectIds: body.projectIds ?? [],
      taskIds: body.taskIds ?? [],
      ownerIds: body.ownerIds ?? [],
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      clientVisible: body.clientVisible ?? false,
      description: body.description ?? "",
      brief: body.brief ?? "",
      billingTotal: body.billingTotal ?? null,
      archive: false,
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/milestones] POST failed:", err);
    return error("failed to create milestone", 500);
  }
}
