/**
 * Inngest background job: Submission Follow-up Reminder.
 *
 * Runs daily at 8am UTC. Queries all submitted RFPs and surfaces any whose
 * due date passed more than 7 days ago without a recorded outcome. Posts a
 * Slack reminder so the team can mark each as won, lost, or no-go.
 */

import { inngest } from "@/lib/inngest/client";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { postToSlack } from "@/lib/slack";

// ── helpers ───────────────────────────────────────────────

function notionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`;
}

// ── function ──────────────────────────────────────────────

export const submissionFollowupFunction = inngest.createFunction(
  {
    id: "submission-followup",
    name: "Submission Follow-up Reminder",
    triggers: [{ cron: "0 8 * * *" }],
  },
  async ({ step }) => {
    const rfps = await step.run("fetch-submitted-rfps", async () => {
      const result = await queryRfpOpportunities(
        { status: "submitted" },
        { pageSize: 100 },
      );
      return result.data;
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const overdueRfps = rfps.filter(
      (rfp) =>
        rfp.dueDate?.start != null &&
        new Date(rfp.dueDate.start) < sevenDaysAgo,
    );

    if (overdueRfps.length === 0) {
      return { ok: true, count: 0 };
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

    await step.run("post-slack", async () => {
      await postToSlack(lines.join("\n"));
    });

    return { ok: true, count };
  },
);
