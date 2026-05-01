import { NextRequest } from "next/server";
import { queryDeals, createDeal } from "@/lib/notion/deals";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";
import type { DealFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: DealFilters = {};

  if (param(req, "stage")) filters.stage = param(req, "stage") as DealFilters["stage"];
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryDeals(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.deal) return error("deal name is required");

  return withNotionError(async () => {
    const deal = await createDeal(body);
    return json(deal, 201);
  });
}
