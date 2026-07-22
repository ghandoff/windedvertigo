/**
 * POST /api/admin/backfill-tor-thumbnails
 *
 * One-time backfill: generate TOR thumbnails for active cards that have a TOR
 * doc/URL but no thumbnail yet. Idempotent, capped per call (Browser Rendering
 * is metered + ~2-15s each); call until remaining=0.
 *
 * Auth: CRON_SECRET bearer. Query: ?limit=N (default 6).
 * Returns: { processed, failed, remaining }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { setRfpTorThumbnail } from "@/lib/supabase/rfp-opportunities";
import { generateTorThumbnail } from "@/lib/rfp/tor-thumbnail";

const ACTIVE = ["radar", "reviewing", "pursuing", "interviewing", "submitted"];

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

async function getBrowser(): Promise<unknown> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx as { env: { BROWSER?: unknown } }).env.BROWSER ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const browser = await getBrowser();
  if (!browser) {
    return NextResponse.json({ error: "browser rendering unavailable" }, { status: 503 });
  }

  const limit = Math.min(15, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 6));

  const { data: rows, error } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, rfp_document_url, url")
    .in("status", ACTIVE)
    .not("rfp_document_url", "is", null)
    .is("tor_thumbnail_url", null)
    .limit(limit + 1);

  if (error) {
    return NextResponse.json({ error: "supabase query failed", detail: error.message }, { status: 500 });
  }

  const all = rows ?? [];
  const batch = all.slice(0, limit);
  const remaining = Math.max(0, all.length - batch.length);

  const processed: string[] = [];
  const failed: { rfpId: string; reason: string }[] = [];

  for (const row of batch) {
    const rfpId = row.notion_page_id as string;
    const target = (row.rfp_document_url as string) || (row.url as string) || null;
    try {
      const thumb = await generateTorThumbnail(rfpId, target, browser);
      if (thumb) {
        await setRfpTorThumbnail(rfpId, thumb);
        processed.push(rfpId);
      } else {
        failed.push({ rfpId, reason: "screenshot returned null (unreachable / not renderable)" });
      }
    } catch (err) {
      failed.push({ rfpId, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  console.warn(`[admin/backfill-tor-thumbnails] processed ${processed.length}, failed ${failed.length}, remaining ${remaining}`);
  return NextResponse.json({ processed, failed, remaining });
}
