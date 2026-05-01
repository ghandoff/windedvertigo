/**
 * GET /api/cycles — list + filter sprint cycles
 * POST /api/cycles — create a new cycle (writes still go to Notion)
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 2h.
 */

import { NextRequest } from "next/server";
import { getCyclesFromSupabase, type CycleSupabaseFilters } from "@/lib/supabase/cycles";
import { createCycle } from "@/lib/notion/cycles";
import { json, error, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: CycleSupabaseFilters = {};
  if (param(req, "status")) filters.status = param(req, "status");
  if (param(req, "projectId")) filters.projectId = param(req, "projectId");
  if (param(req, "search")) filters.search = param(req, "search");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 50;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getCyclesFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/cycles] Supabase query failed:", err);
    return error("failed to load cycles", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.cycle) return error("cycle (name) is required");

  return withNotionError(async () => {
    const c = await createCycle(body);
    return json(c, 201);
  });
}
