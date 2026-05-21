/**
 * POST /api/rfp-radar/[id]/regenerate-proposal
 *
 * Manually re-trigger the proposal generation pipeline for an RFP that is
 * already in "pursuing" status. Useful when:
 *   - A TOR was uploaded *after* the status was set to pursuing
 *   - The previous generation failed or produced a draft without TOR content
 *   - The TOR document was replaced and a fresh draft is needed
 *
 * Guard: returns 409 if a generation is already in progress.
 *
 * The "already generating" check is now atomic via Supabase:
 *   UPDATE rfp_opportunities SET proposal_status='generating', proposal_started_at=NOW()
 *   WHERE notion_page_id = $id
 *     AND (proposal_status IS NULL OR proposal_status NOT IN ('generating'))
 *   RETURNING notion_page_id
 *
 * If 0 rows → another caller already holds the lock → 409.
 * If 1 row → this caller won → enqueue via CF Queue.
 *
 * This eliminates the race condition where two concurrent requests both read
 * proposalStatus != 'generating' from Notion before either has written it back.
 * Notion is also updated (non-atomically) for UI display.
 */

import { NextRequest, NextResponse } from "next/server";
import { updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import { claimProposalGeneration, resetProposalToFailed } from "@/lib/supabase/rfp-opportunities";
import { auth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishJob } from "@windedvertigo/job-queue";
import type { RfpProposalJob } from "@windedvertigo/job-queue/types";
import type { PortCfEnv } from "@/lib/cf-env";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Atomic claim: returns false if another request already holds 'generating'
  let claimed: boolean;
  try {
    claimed = await claimProposalGeneration(id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[regenerate-proposal] supabase claim error:", msg);
    return NextResponse.json(
      { error: "failed to check generation status", detail: msg },
      { status: 500 },
    );
  }

  if (!claimed) {
    return NextResponse.json(
      { error: "proposal is already generating — check back in a minute" },
      { status: 409 },
    );
  }

  // Mirror the status to Notion for UI display (non-atomic, non-critical)
  updateRfpOpportunity(id, { proposalStatus: "generating" }).catch((err) => {
    console.warn("[regenerate-proposal] notion status sync failed (non-fatal):", err);
  });

  const triggeredBy = session.user.email ?? "system";
  const proposalPayload: RfpProposalJob = {
    type: "rfp/generate-proposal",
    rfpId: id,
    triggeredBy,
    requestedAt: new Date().toISOString(),
  };

  // CRITICAL: dispatch must be AWAITED before we return the response.
  // CF Workers kills pending promises the moment the handler returns — so
  // fire-and-forget dispatch would leave the UI stuck at 3% indefinitely.
  try {
    const { env } = getCloudflareContext();
    await publishJob(env.PROPOSAL_QUEUE, proposalPayload);
  } catch (dispatchErr) {
    console.error("[regenerate-proposal] CF Queue dispatch failed:", dispatchErr);
    // The claim already locked the status to "generating" in Supabase.
    // Release the lock so the record doesn't stay stuck.
    await resetProposalToFailed(id).catch((e) =>
      console.warn("[regenerate-proposal] could not release proposal lock:", e),
    );
    return NextResponse.json(
      { error: "failed to start proposal generation — dispatch error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, triggeredBy });
}
