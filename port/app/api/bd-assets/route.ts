/**
 * GET /api/bd-assets — list + filter BD portfolio assets
 * POST /api/bd-assets — create a new BD asset (writes still go to Notion)
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 15 min.
 */

import { NextRequest } from "next/server";
import {
  getBdAssetsFromSupabase,
  type BdAssetSupabaseFilters,
} from "@/lib/supabase/bd-assets";
import { createBdAsset } from "@/lib/notion/bd-assets";
import { json, error, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: BdAssetSupabaseFilters = {};
  if (param(req, "search")) filters.search = param(req, "search");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getBdAssetsFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/bd-assets] Supabase query failed:", err);
    return error("failed to load BD assets", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.asset) return error("asset (name) is required");

  // Creates still go to Notion — source of truth.
  return withNotionError(async () => {
    const asset = await createBdAsset(body);
    return json(asset, 201);
  });
}
