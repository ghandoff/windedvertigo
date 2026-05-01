/**
 * GET  /api/rfp-radar/poll-feedly           — Vercel cron trigger (daily 8:30 AM UTC)
 * GET  /api/rfp-radar/poll-feedly?backfill=true — One-time full-history backfill
 * POST /api/rfp-radar/poll-feedly           — Manual trigger
 *
 * Normal mode: fetches up to 20 unread items, triages each, marks read in Feedly.
 * Backfill mode: fetches ALL items (paginated), skips unread filter and markAsRead.
 *   Use once to seed Notion from your full Feedly RFP board history.
 *   URL dedup in ingestOpportunity prevents re-creating already-ingested records.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 *
 * Required env vars:
 *   FEEDLY_ACCESS_TOKEN  — Feedly session token (from localStorage.feedly.session.feedlyToken)
 *   FEEDLY_STREAM_ID     — Stream/board to monitor
 *                          "user/{userId}/tag/RFP"
 *
 * Response:
 *   { processed, created, skipped, failed, errors[] }
 */

import { NextRequest } from "next/server";
import { ingestOpportunity } from "@/lib/ai/rfp-ingest";
import { notifyNewRfps, type NewRfpItem } from "@/lib/rfp/notify";
import { json, error } from "@/lib/api-helpers";

// Backfill mode can process 100+ items; 300s covers ~60 AI triage calls at ~5s each.
export const maxDuration = 300;

const FEEDLY_BASE = "https://feedly.com/v3";

function verifyAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  return auth.replace("Bearer ", "") === process.env.CRON_SECRET;
}

interface FeedlyEntry {
  id: string;
  title?: string;
  summary?: { content: string };
  content?: { content: string };
  alternate?: { href: string; type?: string }[];
  published?: number;
}

interface FeedlyStream {
  items: FeedlyEntry[];
  continuation?: string; // present when more pages exist
}

async function feedlyFetch(path: string, token: string): Promise<Response> {
  return fetch(`${FEEDLY_BASE}${path}`, {
    headers: { Authorization: `OAuth ${token}` },
  });
}

async function markEntriesRead(entryIds: string[], token: string): Promise<void> {
  await fetch(`${FEEDLY_BASE}/markers`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "markAsRead", type: "entries", entryIds }),
  });
}

/**
 * Fetch all entries from a stream, following continuation tokens for pagination.
 * In normal mode: max 20 unread items (one page, no pagination needed).
 * In backfill mode: all items across all pages.
 */
async function fetchAllEntries(
  streamId: string,
  token: string,
  backfill: boolean,
): Promise<FeedlyEntry[]> {
  const allEntries: FeedlyEntry[] = [];
  const count = backfill ? 250 : 20;
  let continuation: string | undefined;

  do {
    const params = new URLSearchParams({
      streamId,
      count: String(count),
      ...(!backfill && { unreadOnly: "true" }),
      ...(continuation && { continuation }),
    });

    const res = await feedlyFetch(`/streams/contents?${params}`, token);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Feedly API error ${res.status}: ${body}`);
    }

    const stream: FeedlyStream = await res.json();
    allEntries.push(...(stream.items ?? []));

    // Only paginate in backfill mode — normal mode stops after first page
    continuation = backfill ? stream.continuation : undefined;
  } while (continuation);

  return allEntries;
}

async function runPoll(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const token = process.env.FEEDLY_ACCESS_TOKEN;
  const streamId = process.env.FEEDLY_STREAM_ID;

  if (!token) return error("FEEDLY_ACCESS_TOKEN not configured", 500);
  if (!streamId) return error("FEEDLY_STREAM_ID not configured", 500);

  const backfill = req.nextUrl.searchParams.get("backfill") === "true";

  const result = {
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
    backfill,
  };

  let entries: FeedlyEntry[];
  try {
    entries = await fetchAllEntries(streamId, token, backfill);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return error(msg, 502);
  }

  if (entries.length === 0) {
    return json({ ...result, message: "no items in stream" });
  }

  const processedEntryIds: string[] = [];
  const createdForNotification: NewRfpItem[] = [];

  // Process sequentially — each entry makes an AI call; parallel would hammer Anthropic
  for (const entry of entries) {
    result.processed++;
    processedEntryIds.push(entry.id);

    try {
      const title = entry.title?.trim() || "Untitled";
      const body = entry.content?.content ?? entry.summary?.content ?? "";
      const url = entry.alternate?.find((a) => a.href)?.href;

      const outcome = await ingestOpportunity({ title, body, url, source: "RSS Feed" });

      if (outcome.created) {
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
      } else result.skipped++;
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[poll-feedly] entry failed:", entry.title, msg);
      result.errors.push(msg);
    }
  }

  // In normal mode: mark processed entries as read so they won't reappear next poll.
  // In backfill mode: items are already read — skip the markAsRead call.
  if (!backfill && processedEntryIds.length > 0) {
    await markEntriesRead(processedEntryIds, token).catch((err) => {
      console.error("[poll-feedly] markAsRead failed:", err);
    });
  }

  // In backfill mode there could be 100+ items — skip Slack (that'd be unreadable).
  // In normal daily polls the count is small (max 20) — post a single summary.
  if (!backfill) {
    await notifyNewRfps(createdForNotification, "Feedly");
  }

  return json(result);
}

// Vercel cron invokes GET; manual triggers use POST.
export async function GET(req: NextRequest) {
  return runPoll(req);
}

export async function POST(req: NextRequest) {
  return runPoll(req);
}
