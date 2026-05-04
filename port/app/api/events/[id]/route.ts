/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getEventByIdFromSupabase,
  upsertEventToSupabase,
  deleteEventFromSupabase,
} from "@/lib/supabase/events";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const evt = await getEventByIdFromSupabase(id);
    if (!evt) return error("Event not found", 404);
    return json(evt);
  } catch (err) {
    console.error("[api/events/[id]] GET failed:", err);
    return error("failed to load event", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  try {
    const patch: Record<string, unknown> = {};
    if (body.event !== undefined) patch.event = body.event;
    if (body.type !== undefined) patch.type = body.type;
    if (body.eventDates !== undefined) {
      patch.event_start = body.eventDates?.start ?? null;
      patch.event_end = body.eventDates?.end ?? null;
    }
    if (body.proposalDeadline !== undefined) patch.proposal_deadline = body.proposalDeadline?.start ?? null;
    if (body.frequency !== undefined) patch.frequency = body.frequency;
    if (body.location !== undefined) patch.location = body.location;
    if (body.estAttendance !== undefined) patch.est_attendance = body.estAttendance;
    if (body.registrationCost !== undefined) patch.registration_cost = body.registrationCost;
    if (body.quadrantRelevance !== undefined) patch.quadrant_relevance = body.quadrantRelevance;
    if (body.bdSegments !== undefined) patch.bd_segments = body.bdSegments;
    if (body.whoShouldAttend !== undefined) patch.who_should_attend = body.whoShouldAttend;
    if (body.whyItMatters !== undefined) patch.why_it_matters = body.whyItMatters;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.url !== undefined) patch.url = body.url;

    await upsertEventToSupabase(id, patch);

    const updated = await getEventByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/events/[id]] PATCH failed:", err);
    return error("failed to update event", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteEventFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/events/[id]] DELETE failed:", err);
    return error("failed to delete event", 500);
  }
}
