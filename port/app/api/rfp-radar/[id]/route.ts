import { NextRequest, NextResponse } from "next/server";
import { updateRfpOpportunity, archiveRfpOpportunity } from "@/lib/notion/rfp-radar";
import {
  setRfpInfluencedByEventIds,
  setRfpEditableFields,
  getRfpOpportunityByIdFromSupabase,
} from "@/lib/supabase/rfp-opportunities";
import { transitionRfpStatus } from "@/lib/rfp/transition";
import { json, withNotionError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rfp = await getRfpOpportunityByIdFromSupabase(id);
    if (!rfp) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(rfp);
  } catch (err) {
    console.error("[rfp-radar/GET] supabase read failed:", err);
    return NextResponse.json({ error: "failed to load RFP" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  return withNotionError(async () => {
    // Sync all user-editable fields (dueDate, estimatedValue, opportunityName,
    // wvFitScore, serviceMatch, category, geography, source, url, text fields,
    // debrief fields, proposalNotes). Single SQL UPDATE — runs in parallel with
    // the influencedByEventIds write since they touch different columns. Status
    // is handled by the shared transition path below.
    await Promise.all([
      setRfpEditableFields(id, {
        opportunityName:      body.opportunityName,
        opportunityType:      body.opportunityType,
        dueDate:              body.dueDate,
        estimatedValue:       body.estimatedValue,
        wvFitScore:           body.wvFitScore,
        serviceMatch:         body.serviceMatch,
        category:             body.category,
        geography:            body.geography,
        source:               body.source,
        url:                  body.url,
        requirementsSnapshot: body.requirementsSnapshot,
        decisionNotes:        body.decisionNotes,
        whatWorked:           body.whatWorked,
        whatFellFlat:         body.whatFellFlat,
        clientFeedback:       body.clientFeedback,
        lessonsForNextTime:   body.lessonsForNextTime,
        proposalNotes:        body.proposalNotes,
      }),
      // Phase 8 (conference intelligence): Supabase-only column.
      ...(Array.isArray(body.influencedByEventIds)
        ? [setRfpInfluencedByEventIds(id, body.influencedByEventIds)]
        : []),
    ]);

    // Writes all Notion editable fields, incl. status if present.
    const updated = await updateRfpOpportunity(id, body);

    // Status change → the ONE shared transition path (identical to the Biz path):
    // ensures the Supabase status write + the pursuing side-effect (proposal
    // enqueue + GCal). Notion status was just written above, so skip the redundant
    // write. This is what makes a drag and biz_set_bid_decision behave identically.
    if (body.status !== undefined) {
      const session = await auth();
      await transitionRfpStatus(id, body.status, {
        triggeredBy: session?.user?.email ?? "system",
        notionAlreadyWritten: true,
      });
      if (body.status === "pursuing") {
        return json({ ...updated, proposalStatus: "generating" as const });
      }
    }

    return json(updated);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(async () => {
    await archiveRfpOpportunity(id);
    return json({ archived: true });
  });
}
