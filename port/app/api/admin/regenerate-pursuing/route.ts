/**
 * POST /api/admin/regenerate-pursuing
 *
 * Bulk-regenerate proposals for every RFP currently in `status='pursuing'`.
 * Mirrors the per-record /api/rfp-radar/[id]/regenerate-proposal flow but
 * works against all eligible records in one shot. Useful for recovering from
 * a batch failure or after a consumer fix.
 *
 * Auth: CRON_SECRET bearer token (admin-only — bypasses session auth so it
 * can be invoked from the terminal).
 *
 * Returns:
 *   { count, queued: [{rfpId, name}], skipped: [{rfpId, name, reason}] }
 */

import { NextRequest, NextResponse } from "next/server";
import { claimProposalGeneration } from "@/lib/supabase/rfp-opportunities";
import { supabase } from "@/lib/supabase/client";
import { updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import { inngest } from "@/lib/inngest/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishJob } from "@windedvertigo/job-queue";
import type { RfpProposalJob } from "@windedvertigo/job-queue/types";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  return (authHeader?.replace("Bearer ", "") ?? "") === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Find all pursuing RFPs that DON'T already have a ready proposal.
  // Skip `ready-for-review` so we don't overwrite a successful generation
  // when re-triggering after a partial-batch failure.
  const { data: rows, error } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, proposal_status")
    .eq("status", "pursuing");

  if (error) {
    return NextResponse.json({ error: "supabase query failed", detail: error.message }, { status: 500 });
  }

  const allRows = rows ?? [];
  const rfps = allRows.filter((r) => r.proposal_status !== "ready-for-review");
  const preserved = allRows.filter((r) => r.proposal_status === "ready-for-review");

  console.warn(
    `[admin/regenerate-pursuing] starting bulk regen for ${rfps.length} RFPs ` +
    `(${preserved.length} preserved as ready-for-review)`,
  );

  const queued: { rfpId: string; name: string }[] = [];
  const skipped: { rfpId: string; name: string; reason: string }[] = [];
  const triggeredBy = "admin/bulk-regenerate";

  for (const row of rfps) {
    const rfpId = row.notion_page_id as string;
    const name = (row.opportunity_name as string) ?? "(unnamed)";

    // Atomic claim
    let claimed = false;
    try {
      claimed = await claimProposalGeneration(rfpId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped.push({ rfpId, name, reason: `claim failed: ${msg}` });
      continue;
    }

    if (!claimed) {
      skipped.push({ rfpId, name, reason: "another generation already in progress" });
      continue;
    }

    // Mirror to Notion (non-fatal)
    updateRfpOpportunity(rfpId, { proposalStatus: "generating" }).catch((err) => {
      console.warn("[admin/regenerate-pursuing] notion sync failed (non-fatal):", err);
    });

    const payload: RfpProposalJob = {
      type: "rfp/generate-proposal",
      rfpId,
      triggeredBy,
      requestedAt: new Date().toISOString(),
    };

    // Try CF Queue first; fallback to Inngest
    try {
      const { env } = getCloudflareContext();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await publishJob((env as any).PROPOSAL_QUEUE, payload);
      queued.push({ rfpId, name });
    } catch {
      try {
        await inngest.send({ name: "rfp/pursuing.triggered", data: { rfpId, triggeredBy } });
        queued.push({ rfpId, name });
      } catch (inngestErr) {
        const msg = inngestErr instanceof Error ? inngestErr.message : String(inngestErr);
        // Reset claim so the row doesn't stay stuck in generating
        await supabase
          .from("rfp_opportunities")
          .update({ proposal_status: "failed", proposal_step: "failed_at_dispatch: " + msg })
          .eq("notion_page_id", rfpId);
        skipped.push({ rfpId, name, reason: `dispatch failed: ${msg}` });
      }
    }
  }

  console.warn(`[admin/regenerate-pursuing] queued ${queued.length}/${rfps.length}, skipped ${skipped.length}`);
  return NextResponse.json({
    count: rfps.length,
    queued,
    skipped,
  });
}
