/**
 * GET /api/cron/rfp-outcome-scan
 *
 * Scans recent reply emails for RFP outcomes (award / rejection / invited-to-
 * propose), enqueues each as a PROPOSED change in the review queue, and DMs
 * Garrett a link to /inbox to approve or dismiss. Nothing is applied
 * automatically — this is the human-in-the-loop "Finn tracks outcomes" loop.
 *
 * Auth: Bearer CRON_SECRET. Runs daily (registered in lib/scheduled.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { scanRfpOutcomes } from "@/lib/rfp/outcome-scan";
import { countPendingReviews } from "@/lib/review-queue";
import { sendDmByEmail } from "@/lib/slack";

export const maxDuration = 120;

const REVIEWER_EMAIL = process.env.REVIEW_INBOX_EMAIL ?? "garrett@windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return !!auth && auth.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const r = await scanRfpOutcomes();
    if (r.enqueued > 0) {
      const pending = await countPendingReviews().catch(() => r.enqueued);
      const lines = r.items.map((i) => `• ${i}`).join("\n");
      await sendDmByEmail(
        REVIEWER_EMAIL,
        `:mag: ${r.enqueued} pipeline update(s) detected from email, waiting for your review (${pending} pending).\n${lines}\nApprove or dismiss → https://port.windedvertigo.com/inbox`,
      ).catch(() => {});
    }
    console.log("[rfp-outcome-scan]", r);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error("[rfp-outcome-scan] failed:", err);
    return NextResponse.json({ error: "scan failed" }, { status: 500 });
  }
}
