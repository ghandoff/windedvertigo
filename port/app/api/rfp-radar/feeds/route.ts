/**
 * GET  /api/rfp-radar/feeds   — list all feed sources
 * POST /api/rfp-radar/feeds   — create a new feed source
 */

import { NextRequest } from "next/server";
import { queryRfpFeedSources, createRfpFeedSource } from "@/lib/notion/rfp-feeds";
import { json, error, withNotionError } from "@/lib/api-helpers";

export async function GET() {
  return withNotionError(() => queryRfpFeedSources(false));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");

  return withNotionError(async () => {
    const feed = await createRfpFeedSource(body);
    return json(feed, 201);
  });
}
