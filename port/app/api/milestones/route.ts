/**
 * GET /api/milestones — list + filter milestones/phases
 * POST /api/milestones — create a new milestone (writes still go to Notion)
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 15 min.
 */

import { NextRequest } from "next/server";
import {
  getMilestonesFromSupabase,
  type MilestoneSupabaseFilters,
} from "@/lib/supabase/milestones";
import { createMilestone } from "@/lib/notion/milestones";
import { json, error, param, boolParam, withNotionError } from "@/lib/api-helpers";

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

  // Creates still go to Notion — source of truth.
  return withNotionError(async () => {
    const ms = await createMilestone(body);
    return json(ms, 201);
  });
}
