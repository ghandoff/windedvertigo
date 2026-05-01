/**
 * GET /api/projects — list + filter projects
 * POST /api/projects — create a new project (writes still go to Notion)
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 15 min.
 */

import { NextRequest } from "next/server";
import {
  getProjectsFromSupabase,
  type ProjectSupabaseFilters,
} from "@/lib/supabase/projects";
import { createProject } from "@/lib/notion/projects";
import { json, error, param, boolParam, withNotionError } from "@/lib/api-helpers";

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

  // Creates still go to Notion — source of truth.
  return withNotionError(async () => {
    const proj = await createProject(body);
    return json(proj, 201);
  });
}
