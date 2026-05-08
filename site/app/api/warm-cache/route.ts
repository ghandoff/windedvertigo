import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  fetchSiteContent,
  fetchPortfolioAssets,
  fetchPackageBuilderData,
} from "@/lib/notion";

export const dynamic = "force-dynamic";

/**
 * POST /api/warm-cache
 *
 * Called by the every-15-min scheduled cron (via worker-with-scheduled.js) to
 * pre-populate the NOTION_CACHE_KV namespace before the module-level cache
 * expires. Results in sub-100ms page loads at all edge nodes.
 *
 * Protected by CACHE_REFRESH_SECRET bearer token.
 */
export async function POST(req: Request): Promise<NextResponse> {
  // env is typed via global CloudflareEnv in types/cloudflare.d.ts
  const { env } = getCloudflareContext();
  const auth = req.headers.get("Authorization");

  if (!env.CACHE_REFRESH_SECRET || auth !== `Bearer ${env.CACHE_REFRESH_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  console.log("[warm-cache] starting full CMS refresh");

  let home, what, we, doPage, portfolio, packs;
  try {
    // Fetch all CMS data in parallel — each fetcher writes its result to KV
    // (via the withKVCache wrapper in lib/notion.ts) so the cache stays warm.
    [home, what, we, doPage, portfolio, packs] = await Promise.all([
      fetchSiteContent("home"),
      fetchSiteContent("what"),
      fetchSiteContent("we"),
      fetchSiteContent("do"),
      fetchPortfolioAssets(),
      fetchPackageBuilderData(),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[warm-cache] fetch failed after ${Date.now() - start}ms: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const ms = Date.now() - start;
  const counts = {
    home: home.length,
    what: what.length,
    we: we.length,
    do: doPage.length,
    portfolio: portfolio.length,
    packs: Object.keys(packs).length,
  };
  console.log(`[warm-cache] done in ${ms}ms`, counts);

  return NextResponse.json({ ok: true, ms, counts });
}
