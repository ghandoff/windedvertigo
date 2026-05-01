/**
 * GET /api/competitors — list + filter competitors
 * POST /api/competitors — create a new competitor (writes still go to Notion)
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 6h.
 */

import { NextRequest } from "next/server";
import { getCompetitorsFromSupabase, type CompetitorSupabaseFilters } from "@/lib/supabase/competitors";
import { createCompetitor } from "@/lib/notion/competitive";
import { json, error, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: CompetitorSupabaseFilters = {};
  if (param(req, "type")) filters.type = param(req, "type");
  if (param(req, "threatLevel")) filters.threatLevel = param(req, "threatLevel");
  if (param(req, "quadrantOverlap")) filters.quadrantOverlap = param(req, "quadrantOverlap");
  if (param(req, "geography")) filters.geography = param(req, "geography");
  if (param(req, "search")) filters.search = param(req, "search");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 50;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getCompetitorsFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/competitors] Supabase query failed:", err);
    return error("failed to load competitors", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.organisation) return error("organisation (name) is required");

  return withNotionError(async () => {
    const comp = await createCompetitor(body);
    return json(comp, 201);
  });
}
