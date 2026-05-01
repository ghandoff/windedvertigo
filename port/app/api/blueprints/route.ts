/**
 * GET /api/blueprints — list + filter campaign blueprints
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * Blueprints are read-only in the UI; writes go through Notion directly.
 * Sync cron mirrors within 6h (daily in practice — blueprints change rarely).
 */

import { NextRequest } from "next/server";
import { getBlueprintsFromSupabase, type BlueprintSupabaseFilters } from "@/lib/supabase/blueprints";
import { json, error, param } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: BlueprintSupabaseFilters = {};
  if (param(req, "category")) filters.category = param(req, "category");
  if (param(req, "channel")) filters.channel = param(req, "channel");
  if (param(req, "search")) filters.search = param(req, "search");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 50;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getBlueprintsFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/blueprints] Supabase query failed:", err);
    return error("failed to load blueprints", 500);
  }
}
