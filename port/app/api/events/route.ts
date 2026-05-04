/**
 * GET /api/events — list + filter events & conferences
 * POST /api/events — create a new event
 *
 * Phase G.1.3: GET reads from Supabase.
 * Phase A3: POST writes to Supabase directly (Notion write retired).
 */

import { NextRequest } from "next/server";
import {
  getEventsFromSupabase,
  upsertEventToSupabase,
  type EventSupabaseFilters,
} from "@/lib/supabase/events";
import { json, error, param } from "@/lib/api-helpers";

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

  try {
    const id = crypto.randomUUID();
    await upsertEventToSupabase(id, {
      event: body.event,
      type: body.type ?? null,
      event_start: body.eventDates?.start ?? null,
      event_end: body.eventDates?.end ?? null,
      proposal_deadline: body.proposalDeadline?.start ?? null,
      frequency: body.frequency ?? null,
      location: body.location ?? null,
      est_attendance: body.estAttendance ?? null,
      registration_cost: body.registrationCost ?? null,
      quadrant_relevance: body.quadrantRelevance ?? [],
      bd_segments: body.bdSegments ?? null,
      who_should_attend: body.whoShouldAttend ?? [],
      why_it_matters: body.whyItMatters ?? null,
      notes: body.notes ?? null,
      url: body.url ?? null,
    });

    return json({
      id,
      event: body.event,
      type: body.type ?? "Conference",
      eventDates: body.eventDates ?? null,
      proposalDeadline: body.proposalDeadline ?? null,
      frequency: body.frequency ?? null,
      location: body.location ?? "",
      estAttendance: body.estAttendance ?? "",
      registrationCost: body.registrationCost ?? "",
      quadrantRelevance: body.quadrantRelevance ?? [],
      bdSegments: body.bdSegments ?? "",
      whoShouldAttend: body.whoShouldAttend ?? [],
      whyItMatters: body.whyItMatters ?? "",
      notes: body.notes ?? "",
      url: body.url ?? "",
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/events] POST failed:", err);
    return error("failed to create event", 500);
  }
}
