import { NextRequest } from "next/server";
import { queryEvents, createEvent } from "@/lib/notion/events";
import { json, error, parsePagination, parseSort, param, boolParam, withNotionError } from "@/lib/api-helpers";
import type { EventFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: EventFilters = {};

  if (param(req, "type")) filters.type = param(req, "type") as EventFilters["type"];
  if (param(req, "quadrantRelevance")) filters.quadrantRelevance = param(req, "quadrantRelevance") as EventFilters["quadrantRelevance"];
  if (param(req, "whoShouldAttend")) filters.whoShouldAttend = param(req, "whoShouldAttend") as EventFilters["whoShouldAttend"];
  if (boolParam(req, "upcoming") !== undefined) filters.upcoming = boolParam(req, "upcoming");
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryEvents(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.event) return error("event (name) is required");

  return withNotionError(async () => {
    const evt = await createEvent(body);
    return json(evt, 201);
  });
}
