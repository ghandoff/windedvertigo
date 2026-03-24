import { NextRequest } from "next/server";
import { queryCompetitors, createCompetitor } from "@/lib/notion/competitive";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";
import type { CompetitorFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: CompetitorFilters = {};

  if (param(req, "type")) filters.type = param(req, "type") as CompetitorFilters["type"];
  if (param(req, "threatLevel")) filters.threatLevel = param(req, "threatLevel") as CompetitorFilters["threatLevel"];
  if (param(req, "quadrantOverlap")) filters.quadrantOverlap = param(req, "quadrantOverlap") as CompetitorFilters["quadrantOverlap"];
  if (param(req, "geography")) filters.geography = param(req, "geography") as CompetitorFilters["geography"];
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryCompetitors(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.organisation) return error("organisation (name) is required");

  return withNotionError(async () => {
    const comp = await createCompetitor(body);
    return json(comp, 201);
  });
}
