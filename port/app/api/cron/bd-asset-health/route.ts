/**
 * GET /api/cron/bd-asset-health
 *
 * Every Monday at 9am UTC — migrated from lib/inngest/functions/bd-asset-health.ts (G.2.3).
 *
 * Queries all BD assets and identifies any that have not been updated in more
 * than 12 months. Posts a Slack report listing stale assets so the team can
 * refresh them before proposals go out.
 *
 * Previously triggered by: Inngest cron `0 9 * * 1`
 * Now triggered by: CF scheduled() hourly router in lib/scheduled.ts
 *
 * Requires env vars: CRON_SECRET, NOTION_TOKEN, SLACK_BOT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { queryBdAssets } from "@/lib/notion/bd-assets";
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

function monthsSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24 * 30.44);
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  console.log("[cron/bd-asset-health] starting");

  if (!verifyCronAuth(req)) {
    console.warn("[cron/bd-asset-health] unauthorized request");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let assets;
  try {
    const result = await queryBdAssets(undefined, { pageSize: 200 });
    assets = result.data;
    console.log(`[cron/bd-asset-health] fetched ${assets.length} BD assets`);
  } catch (err) {
    console.error("[cron/bd-asset-health] failed to fetch BD assets:", err);
    return NextResponse.json({ error: "failed to fetch assets" }, { status: 500 });
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const staleAssets = assets.filter(
    (asset) => new Date(asset.lastEditedTime) < twelveMonthsAgo,
  );

  if (staleAssets.length === 0) {
    console.log(`[cron/bd-asset-health] no stale assets (${Date.now() - start}ms)`);
    return NextResponse.json({ ok: true, staleCount: 0 });
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

  try {
    await postToSlack(lines.join("\n"));
    console.log(`[cron/bd-asset-health] posted Slack report (${staleCount} stale, ${Date.now() - start}ms)`);
  } catch (err) {
    console.error("[cron/bd-asset-health] Slack post failed:", err);
    return NextResponse.json(
      { ok: false, staleCount, error: "slack post failed" },
      { status: 207 },
    );
  }

  return NextResponse.json({ ok: true, staleCount });
}
