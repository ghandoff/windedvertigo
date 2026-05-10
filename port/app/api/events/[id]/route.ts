/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 *
 * Phase 1 (conference intelligence): PATCH also accepts triage fields
 * (status, lifecycleState, fitScore, triageNotes, ownerUserId) and routes
 * them through setEventTriageStatus, which stamps `triaged_at` and
 * `triaged_by` automatically. Triage actions are auth-gated; descriptive
 * field edits are too (anyone signed-in can run either).
 */
import { NextRequest } from "next/server";
import {
  getEventByIdFromSupabase,
  upsertEventToSupabase,
  deleteEventFromSupabase,
  setEventTriageStatus,
  type TriageUpdate,
} from "@/lib/supabase/events";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

const TRIAGE_KEYS = [
  "status",
  "lifecycleState",
  "fitScore",
  "triageNotes",
  "ownerUserId",
] as const;

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

  // Auth: any signed-in @windedvertigo.com user can edit or triage.
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  try {
    // Triage actions arrive with at least one of the triage keys; route
    // them through setEventTriageStatus so triaged_at/by are stamped.
    const triageUpdate: Partial<TriageUpdate> = {};
    let isTriage = false;
    for (const key of TRIAGE_KEYS) {
      if (body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (triageUpdate as any)[key] = body[key];
        isTriage = true;
      }
    }
    if (isTriage) {
      await setEventTriageStatus(id, {
        ...triageUpdate,
        triagedBy: session.user.email,
      });
    }

    // Descriptive-field edits (event name, dates, etc.) flow through the
    // existing upsert path. Both branches can run in the same request if
    // the form sends mixed updates.
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
    // Phase 1 descriptive additions: deadlines + cost fields.
    if (body.deadlines !== undefined)       patch.deadlines = body.deadlines;
    if (body.estTravelCost !== undefined)   patch.est_travel_cost = body.estTravelCost;
    if (body.sponsorshipFee !== undefined)  patch.sponsorship_fee = body.sponsorshipFee;
    if (body.actualCostTotal !== undefined) patch.actual_cost_total = body.actualCostTotal;
    if (body.currency !== undefined)        patch.currency = body.currency;
    if (body.outcomeNotes !== undefined)    patch.outcome_notes = body.outcomeNotes;
    if (body.contactsMetCount !== undefined) patch.contacts_met_count = body.contactsMetCount;
    if (body.followupDueBy !== undefined)   patch.followup_due_by = body.followupDueBy;
    if (body.affiliatedOrgId !== undefined) patch.affiliated_org_id = body.affiliatedOrgId;
    // Phase 16 cover image
    if (body.coverImageUrl !== undefined)   patch.cover_image_url = body.coverImageUrl;

    if (Object.keys(patch).length > 0) {
      await upsertEventToSupabase(id, patch);
    }

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
