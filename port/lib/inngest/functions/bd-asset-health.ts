/**
 * Inngest background job: BD Asset Health Monitoring.
 *
 * Runs every Monday at 9am UTC. Queries all BD assets and identifies any
 * that have not been updated in more than 12 months. Posts a Slack report
 * listing stale assets so the team can refresh them before proposals go out.
 */

import { inngest } from "@/lib/inngest/client";
import { queryBdAssets } from "@/lib/notion/bd-assets";
import { postToSlack } from "@/lib/slack";

// ── helpers ───────────────────────────────────────────────

function notionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`;
}

function monthsSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24 * 30.44);
}

// ── function ──────────────────────────────────────────────

export const bdAssetHealthFunction = inngest.createFunction(
  {
    id: "bd-asset-health",
    name: "BD Asset Health Check",
    triggers: [{ cron: "0 9 * * 1" }],
  },
  async ({ step }) => {
    const assets = await step.run("fetch-bd-assets", async () => {
      const result = await queryBdAssets(undefined, { pageSize: 200 });
      return result.data;
    });

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const staleAssets = assets.filter(
      (asset) => new Date(asset.lastEditedTime) < twelveMonthsAgo,
    );

    if (staleAssets.length === 0) {
      return { ok: true, staleCount: 0 };
    }

    const staleCount = staleAssets.length;
    const displayAssets = staleAssets.slice(0, 15);

    const lines: string[] = [
      `🗂️ *BD Asset Health Report* — ${staleCount} asset(s) need a refresh`,
      "",
    ];

    for (const asset of displayAssets) {
      const monthsAgo = Math.floor(monthsSince(asset.lastEditedTime));
      lines.push(`• <${notionUrl(asset.id)}|${asset.asset}> — last updated ${monthsAgo}mo ago`);
    }

    if (staleCount > 15) {
      lines.push(`_…and ${staleCount - 15} more_`);
    }

    lines.push("");
    lines.push("Review and update in Notion to keep proposals sharp.");

    await step.run("post-slack", async () => {
      await postToSlack(lines.join("\n"));
    });

    return { ok: true, staleCount };
  },
);
