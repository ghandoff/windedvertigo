import { NextRequest } from "next/server";
import { queryCampaigns, createCampaign } from "@/lib/notion/campaigns";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";
import type { CampaignFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: CampaignFilters = {};
  if (param(req, "status")) filters.status = param(req, "status") as CampaignFilters["status"];
  if (param(req, "type")) filters.type = param(req, "type") as CampaignFilters["type"];
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryCampaigns(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");

  return withNotionError(async () => {
    const campaign = await createCampaign(body);
    return json(campaign, 201);
  });
}
