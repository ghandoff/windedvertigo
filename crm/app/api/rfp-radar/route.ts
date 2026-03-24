import { NextRequest } from "next/server";
import { queryRfpOpportunities, createRfpOpportunity } from "@/lib/notion/rfp-radar";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";
import type { RfpFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: RfpFilters = {};

  if (param(req, "status")) filters.status = param(req, "status") as RfpFilters["status"];
  if (param(req, "opportunityType")) filters.opportunityType = param(req, "opportunityType") as RfpFilters["opportunityType"];
  if (param(req, "wvFitScore")) filters.wvFitScore = param(req, "wvFitScore") as RfpFilters["wvFitScore"];
  if (param(req, "source")) filters.source = param(req, "source") as RfpFilters["source"];
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryRfpOpportunities(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.opportunityName) return error("opportunityName is required");

  return withNotionError(async () => {
    const rfp = await createRfpOpportunity(body);
    return json(rfp, 201);
  });
}
