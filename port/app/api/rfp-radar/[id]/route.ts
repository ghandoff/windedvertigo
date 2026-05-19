import { NextRequest, NextResponse } from "next/server";
import { updateRfpOpportunity, archiveRfpOpportunity } from "@/lib/notion/rfp-radar";
import {
  setRfpInfluencedByEventIds,
  setRfpStatus,
  setRfpEditableFields,
  getRfpOpportunityByIdFromSupabase,
  setProposalStatus,
} from "@/lib/supabase/rfp-opportunities";
import { json, withNotionError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { createRfpDeadlineEvent } from "@/lib/gcal";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishJob } from "@windedvertigo/job-queue";
import type { RfpProposalJob } from "@windedvertigo/job-queue/types";
import type { PortCfEnv } from "@/lib/cf-env";

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
    // Keep Supabase in sync with Notion before the Notion write — the detail
    // page and Kanban board both read from Supabase, so any field that is only
    // written to Notion will appear stale (showing old data) until the sync
    // cron fires ~15 min later.
    if (body.status !== undefined) {
      await setRfpStatus(id, body.status);
    }

    // Sync all user-editable fields (dueDate, estimatedValue, opportunityName,
    // wvFitScore, serviceMatch, category, geography, source, url, text fields,
    // debrief fields, proposalNotes). Single SQL UPDATE — runs in parallel with
    // the influencedByEventIds write since they touch different columns.
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

    const updated = await updateRfpOpportunity(id, body);

    // Trigger proposal generation when an RFP moves to "pursuing" —
    // Guard reads from Supabase (the authoritative read layer) rather than the
    // Notion response object: Notion's proposalStatus lags Supabase by up to
    // 15 min (sync cron cadence), so using updated.proposalStatus could allow
    // duplicate jobs when a card is re-dragged mid-generation.
    if (body.status === "pursuing") {
      const freshState = await getRfpOpportunityByIdFromSupabase(id).catch(() => null);
      const alreadyActive =
        freshState?.proposalStatus === "complete" ||
        freshState?.proposalStatus === "generating" ||
        freshState?.proposalStatus === "queued";

      if (!alreadyActive) {
        const session = await auth();
        const triggeredBy = session?.user?.email ?? "system";

        // Mark as generating in both Notion and Supabase *before* returning so
        // the UI sees it on the next router.refresh() from either source.
        await Promise.all([
          updateRfpOpportunity(id, { proposalStatus: "generating" }),
          setProposalStatus(id, "generating"),
        ]);
        const withGenerating = { ...updated, proposalStatus: "generating" as const };

        // Fire-and-forget — don't block the UI response
        // G.2.3: CF Workers → CF Queue; Vercel canary → Inngest fallback
        const proposalPayload: RfpProposalJob = {
          type: "rfp/generate-proposal",
          rfpId: id,
          triggeredBy,
          requestedAt: new Date().toISOString(),
        };
        const { env } = getCloudflareContext();
        publishJob(env.PROPOSAL_QUEUE, proposalPayload).catch((err) => {
          console.warn("[rfp-radar] failed to enqueue proposal job:", err);
        });

        // Auto-create a Google Calendar deadline event — fire-and-forget, never blocks
        createRfpDeadlineEvent(updated).catch((err) => {
          console.warn("[rfp-radar] failed to create GCal deadline event:", err);
        });

        return json(withGenerating);
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
