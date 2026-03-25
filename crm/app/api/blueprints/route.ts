import { NextRequest } from "next/server";
import { queryBlueprints } from "@/lib/notion/blueprints";
import { parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";
import type { BlueprintFilters } from "@/lib/notion/types";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const filters: BlueprintFilters = {};
  if (param(req, "category")) filters.category = param(req, "category") as BlueprintFilters["category"];
  if (param(req, "channel")) filters.channel = param(req, "channel") as BlueprintFilters["channel"];
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryBlueprints(filters, parsePagination(req), parseSort(req)),
  );
}
