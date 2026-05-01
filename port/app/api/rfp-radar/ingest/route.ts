/**
 * POST /api/rfp-radar/ingest
 *
 * Webhook-style endpoint for automated RFP ingestion from any source.
 * Accepts a raw title + body, runs AI triage, deduplicates, and creates
 * an RfpOpportunity record in Notion if the content is a real opportunity.
 *
 * Called by:
 *   - The rfp-gmail-scanner scheduled task (Gmail delegate inbox scanning)
 *   - Any external webhook / Zapier / Make automation
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 *
 * Request body:
 *   { title: string, body: string, url?: string, source?: RfpSource }
 *
 * Response:
 *   201 { created: true,  id, fitScore, triage }
 *   200 { created: false, skipped, triage? }
 *   401 { error: "unauthorized" }
 *   400 { error: "..." }
 *   500 { error: "..." }
 */

import { NextRequest } from "next/server";
import { ingestOpportunity } from "@/lib/ai/rfp-ingest";
import { notifyNewRfps } from "@/lib/rfp/notify";
import { json, error } from "@/lib/api-helpers";
import type { RfpSource } from "@/lib/notion/types";

// AI triage + Notion write can take 5–10s; 60s is safe for typical loads.
export const maxDuration = 60;

function verifyAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  return auth.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.body) {
    return error("title and body are required");
  }

  const { title, body: content, url, source } = body as {
    title: string;
    body: string;
    url?: string;
    source?: RfpSource;
  };

  try {
    const result = await ingestOpportunity({ title, body: content, url, source });

    // Single-item Slack ping for webhook-triggered ingests (Zapier / Make / etc).
    // notifyNewRfps is fail-open so Slack hiccups don't turn into webhook 500s.
    if (result.created) {
      await notifyNewRfps(
        [{
          name: result.triage.opportunityName,
          fitScore: result.fitScore,
          dueDate: result.triage.dueDate,
          url: result.url,
          notionPageId: result.id,
          torStatus: result.torStatus,
          torUrl: result.torUrl,
        }],
        "webhook",
      );
    }

    const status = result.created ? 201 : 200;
    return json(result, status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ingest failed";
    console.error("[rfp-radar/ingest]", msg);
    return error(msg, 500);
  }
}
