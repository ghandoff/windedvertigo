import { NextRequest, NextResponse } from "next/server";
import { updateRfpOpportunity, archiveRfpOpportunity } from "@/lib/notion/rfp-radar";
import {
  setRfpInfluencedByEventIds,
  setRfpStatus,
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
    // Keep Supabase status in sync with Notion — the board reads from Supabase,
    // so without this write every drag/dropdown/edit-form change snaps back after
    // router.refresh() (Supabase returned the old status, DraggableKanban useEffect
    // reset items to initialItems). Must run before the Notion write so the
    // server re-render always sees the new status.
    if (body.status !== undefined) {
      await setRfpStatus(id, body.status);
    }

    // Phase 8 (conference intelligence): influencedByEventIds is a Supabase-
    // only column — Notion has no equivalent property — so write it directly
    // before the Notion update. Idempotent; pass an empty array to clear.
    if (Array.isArray(body.influencedByEventIds)) {
      await setRfpInfluencedByEventIds(id, body.influencedByEventIds);
    }

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
