/**
 * GET  /api/rfp-radar/poll-rss  — Vercel cron trigger (daily 8:15 AM UTC)
 * POST /api/rfp-radar/poll-rss  — Manual trigger
 *
 * Polls all enabled RSS/Atom feeds from the Notion "RFP feed sources"
 * database, runs AI triage on each item, and creates RfpOpportunity
 * records for genuine opportunities. Updates lastPolled + itemsLastRun
 * on each feed record after processing.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 *
 * Response: { feeds, processed, created, skipped, failed, results[], errors[] }
 */

import { NextRequest } from "next/server";
import { fetchFeed } from "@/lib/rfp/rss-parser";
import { getAllFeeds } from "@/lib/rfp/feed-sources";
import { updateRfpFeedSource } from "@/lib/notion/rfp-feeds";
import { ingestOpportunity } from "@/lib/ai/rfp-ingest";
import { notifyNewRfps, type NewRfpItem } from "@/lib/rfp/notify";
import { json, error } from "@/lib/api-helpers";

export const maxDuration = 300;

function verifyAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  return auth.replace("Bearer ", "") === process.env.CRON_SECRET;
}

interface FeedResult {
  feed: string;
  fetched: number;
  created: number;
  skipped: number;
  failed: number;
}

async function runPoll() {

  const feeds = await getAllFeeds();
  const result = {
    feeds: feeds.length,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    results: [] as FeedResult[],
    errors: [] as string[],
  };

  if (feeds.length === 0) {
    return json({ ...result, message: "no enabled feeds configured" });
  }

  // Fetch all feed XMLs concurrently (HTTP only, no AI yet)
  const fetched = await Promise.all(
    feeds.map(async (feed) => ({
      feed,
      items: await fetchFeed(feed.url),
    })),
  );

  const today = new Date().toISOString().split("T")[0];

  // Accumulate all newly-created RFPs across every feed so we can post one
  // Slack summary at the end of the run rather than one per feed (noise).
  const createdForNotification: NewRfpItem[] = [];

  // Process each feed sequentially to stay under Anthropic rate limits
  for (const { feed, items } of fetched) {
    const feedResult: FeedResult = {
      feed: feed.label,
      fetched: items.length,
      created: 0,
      skipped: 0,
      failed: 0,
    };

    for (const item of items) {
      result.processed++;
      try {
        const outcome = await ingestOpportunity({
          title: item.title,
          body: item.body,
          url: item.url,
          source: feed.source,
        });
        if (outcome.created) {
          feedResult.created++;
          result.created++;
          createdForNotification.push({
            name: outcome.triage.opportunityName,
            fitScore: outcome.fitScore,
            dueDate: outcome.triage.dueDate,
            url: outcome.url,
            notionPageId: outcome.id,
            torStatus: outcome.torStatus,
            torUrl: outcome.torUrl,
          });
        } else {
          feedResult.skipped++;
          result.skipped++;
        }
      } catch (err) {
        feedResult.failed++;
        result.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[poll-rss] ${feed.name} item failed:`, item.title, msg);
        result.errors.push(`${feed.label}: ${msg}`);
      }
    }

    result.results.push(feedResult);

    // Write back poll stats to Notion (non-blocking, best-effort)
    updateRfpFeedSource(feed.id, {
      lastPolled: today,
      itemsLastRun: items.length,
    }).catch((e) => console.warn(`[poll-rss] failed to update feed stats for ${feed.name}:`, e));
  }

  // Slack summary — fail-open, already awaited so logs flush before we return.
  await notifyNewRfps(createdForNotification, "RSS feeds");

  return json(result);
}

// Vercel cron invokes GET; manual triggers use POST.
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);
  return runPoll();
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);
  return runPoll();
}
