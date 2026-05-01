/**
 * GET /api/rfp-radar — list + filter RFP opportunities
 * POST /api/rfp-radar — create a new RFP opportunity (writes still go to Notion)
 *
 * Phase G.1.4: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 15 min.
 */

import { NextRequest } from "next/server";
import {
  getRfpOpportunitiesFromSupabase,
  type RfpOpportunitySupabaseFilters,
} from "@/lib/supabase/rfp-opportunities";
import { createRfpOpportunity } from "@/lib/notion/rfp-radar";
import { json, error, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: RfpOpportunitySupabaseFilters = {};

  if (param(req, "status"))          filters.status          = param(req, "status")!;
  if (param(req, "opportunityType")) filters.opportunityType = param(req, "opportunityType")!;
  if (param(req, "wvFitScore"))      filters.wvFitScore      = param(req, "wvFitScore")!;
  if (param(req, "source"))          filters.source          = param(req, "source")!;
  if (param(req, "search"))          filters.search          = param(req, "search")!;
  if (param(req, "orgId"))           filters.orgId           = param(req, "orgId")!;

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getRfpOpportunitiesFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/rfp-radar] Supabase query failed:", err);
    return error("failed to load rfp opportunities", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.opportunityName) return error("opportunityName is required");

  return withNotionError(async () => {
    const rfp = await createRfpOpportunity(body);
    return json(rfp, 201);
  });
}
