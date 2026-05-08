import { NextRequest, NextResponse } from "next/server";
import { updateRfpOpportunity, archiveRfpOpportunity } from "@/lib/notion/rfp-radar";
import { setRfpInfluencedByEventIds } from "@/lib/supabase/rfp-opportunities";
import { getRfpOpportunityByIdFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { json, withNotionError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
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
    // Phase 8 (conference intelligence): influencedByEventIds is a Supabase-
    // only column — Notion has no equivalent property — so write it directly
    // before the Notion update. Idempotent; pass an empty array to clear.
    if (Array.isArray(body.influencedByEventIds)) {
      await setRfpInfluencedByEventIds(id, body.influencedByEventIds);
    }

    const updated = await updateRfpOpportunity(id, body);

    // Trigger proposal generation when an RFP moves to "pursuing" —
    // skip if a draft is already generating or complete to prevent duplicates.
    if (
      body.status === "pursuing" &&
      updated.proposalStatus !== "complete" &&
      updated.proposalStatus !== "generating"
    ) {
      const session = await auth();
      const triggeredBy = session?.user?.email ?? "system";

      // Mark as generating in Notion *before* returning so the UI sees it on refresh
      await updateRfpOpportunity(id, { proposalStatus: "generating" });
      const withGenerating = { ...updated, proposalStatus: "generating" as const };

      // Fire-and-forget — don't block the UI response
      // G.2.3: CF Workers → CF Queue; Vercel canary → Inngest fallback
      const proposalPayload: RfpProposalJob = {
        type: "rfp/generate-proposal",
        rfpId: id,
        triggeredBy,
        requestedAt: new Date().toISOString(),
      };
      try {
        const { env } = getCloudflareContext();
        publishJob(env.PROPOSAL_QUEUE, proposalPayload).catch((err) => {
          console.warn("[rfp-radar] failed to enqueue proposal job:", err);
        });
      } catch {
        inngest.send({ name: "rfp/pursuing.triggered", data: { rfpId: id, triggeredBy } }).catch((err) => {
          console.warn("[rfp-radar] failed to dispatch proposal generation event:", err);
        });
      }

      // Auto-create a Google Calendar deadline event — fire-and-forget, never blocks
      createRfpDeadlineEvent(updated).catch((err) => {
        console.warn("[rfp-radar] failed to create GCal deadline event:", err);
      });

      return json(withGenerating);
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
