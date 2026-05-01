/**
 * GET /api/cron/submission-followup
 *
 * Daily at 8am UTC — migrated from lib/inngest/functions/submission-followup.ts (G.2.3).
 *
 * Queries all submitted RFPs and surfaces any whose due date passed more than
 * 7 days ago without a recorded outcome. Posts a Slack reminder so the team
 * can mark each as won, lost, or no-go.
 *
 * Previously triggered by: Inngest cron `0 8 * * *`
 * Now triggered by: CF scheduled() hourly router in lib/scheduled.ts
 *
 * Requires env vars: CRON_SECRET, NOTION_TOKEN, SLACK_BOT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { postToSlack } from "@/lib/slack";

export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

function notionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`;
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  console.log("[cron/submission-followup] starting");

  if (!verifyCronAuth(req)) {
    console.warn("[cron/submission-followup] unauthorized request");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rfps;
  try {
    const result = await queryRfpOpportunities(
      { status: "submitted" },
      { pageSize: 100 },
    );
    rfps = result.data;
    console.log(`[cron/submission-followup] fetched ${rfps.length} submitted RFPs`);
  } catch (err) {
    console.error("[cron/submission-followup] failed to fetch RFPs:", err);
    return NextResponse.json({ error: "failed to fetch RFPs" }, { status: 500 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const overdueRfps = rfps.filter(
    (rfp) =>
      rfp.dueDate?.start != null &&
      new Date(rfp.dueDate.start) < sevenDaysAgo,
  );

  if (overdueRfps.length === 0) {
    console.log(`[cron/submission-followup] no overdue RFPs (${Date.now() - start}ms)`);
    return NextResponse.json({ ok: true, count: 0 });
  }

  const count = overdueRfps.length;

  const lines: string[] = [
    `📬 *Submission Follow-up* — ${count} RFP(s) past deadline with no outcome recorded`,
    "",
  ];

  for (const rfp of overdueRfps) {
    const duePart = rfp.dueDate!.start;
    const valuePart =
      rfp.estimatedValue != null
        ? ` · $${rfp.estimatedValue.toLocaleString()}`
        : "";
    lines.push(
      `• <${notionUrl(rfp.id)}|${rfp.opportunityName}> — submitted, due ${duePart}${valuePart}`,
    );
  }

  lines.push("");
  lines.push(
    "Mark each as won, lost, or no-go in RFP Lighthouse once the decision is known.",
  );

  try {
    await postToSlack(lines.join("\n"));
    console.log(`[cron/submission-followup] posted Slack reminder (${count} overdue, ${Date.now() - start}ms)`);
  } catch (err) {
    console.error("[cron/submission-followup] Slack post failed:", err);
    return NextResponse.json(
      { ok: false, count, error: "slack post failed" },
      { status: 207 },
    );
  }

  return NextResponse.json({ ok: true, count });
}
