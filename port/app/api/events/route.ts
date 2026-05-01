/**
 * GET /api/events — list + filter events & conferences
 * POST /api/events — create a new event (writes still go to Notion)
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 15 min.
 */

import { NextRequest } from "next/server";
import {
  getEventsFromSupabase,
  type EventSupabaseFilters,
} from "@/lib/supabase/events";
import { createEvent } from "@/lib/notion/events";
import { json, error, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: EventSupabaseFilters = {};
  if (param(req, "type"))           filters.type           = param(req, "type");
  if (param(req, "whoShouldAttend")) filters.whoShouldAttend = param(req, "whoShouldAttend");
  if (param(req, "search"))         filters.search         = param(req, "search");
  if (url.searchParams.get("upcoming") === "true") filters.upcoming = true;

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getEventsFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/events] Supabase query failed:", err);
    return error("failed to load events", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.event) return error("event (name) is required");

  // Creates still go to Notion — source of truth.
  return withNotionError(async () => {
    const evt = await createEvent(body);
    return json(evt, 201);
  });
}
