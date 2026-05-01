/**
 * POST /api/admin/sync-tiles
 *
 * Sync harbour tile cover images from Notion → R2.
 *
 * For each row in the harbour-games Notion database, downloads the page
 * cover (Notion serves a fresh signed URL on every API call, so the URL
 * is valid here) and uploads to R2 at `harbour-tiles/{slug}.png`. Then
 * lib/notion.ts → tileImageUrl() reads `R2_PUBLIC_URL/harbour-tiles/{slug}.png`
 * directly — no Notion dependency at request time.
 *
 * Auth: Bearer CRON_SECRET (same secret used for /api/revalidate). Harbour
 * has no user accounts so this admin gate is the simplest pattern.
 *
 * Why a Worker endpoint instead of a Node script?
 * The Worker has the `TILE_IMAGES` R2 binding (no access keys needed).
 * Running locally would require provisioning R2 access keys for the
 * garrett account, which is extra credential surface area we'd rather
 * avoid. The endpoint is bearer-protected and only the admin (or a cron)
 * triggers it.
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NOTION_DB_HARBOUR_GAMES = "8e3f3364b2654640a91ed0f38b091a07";
const KEY_PREFIX = "harbour-tiles";

interface SyncResult {
  slug: string;
  status: "uploaded" | "skipped-no-cover" | "failed";
  bytes?: number;
  error?: string;
}

function verifyAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  if (!header) return false;
  const token = header.replace(/^Bearer\s+/, "");
  return token === process.env.CRON_SECRET;
}

interface NotionPage {
  id: string;
  cover?: { type: string; file?: { url: string }; external?: { url: string } } | null;
  properties?: Record<string, unknown>;
}

function extractSlug(page: NotionPage): string | null {
  const props = page.properties ?? {};
  const slugProp = props.Slug as
    | { type?: string; rich_text?: Array<{ plain_text?: string }> }
    | undefined;
  if (slugProp?.type === "rich_text" && slugProp.rich_text && slugProp.rich_text.length > 0) {
    return slugProp.rich_text.map((r) => r.plain_text ?? "").join("");
  }
  return null;
}

function extractCoverUrl(page: NotionPage): string | null {
  const cover = page.cover;
  if (!cover) return null;
  if (cover.type === "external" && cover.external) return cover.external.url;
  if (cover.type === "file" && cover.file) return cover.file.url;
  return null;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = getCloudflareContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bucket = (ctx.env as any).TILE_IMAGES;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assets = (ctx.env as any).ASSETS;
  if (!bucket) {
    return NextResponse.json(
      { error: "TILE_IMAGES R2 binding not configured" },
      { status: 500 },
    );
  }

  const notion = new Client({ auth: process.env.NOTION_TOKEN });

  // v5: discover the data source ID
  const db = await notion.databases.retrieve({
    database_id: NOTION_DB_HARBOUR_GAMES,
  });
  if (!("data_sources" in db) || db.data_sources.length === 0) {
    return NextResponse.json(
      { error: "no data sources for harbour games database" },
      { status: 500 },
    );
  }
  const dsId = db.data_sources[0].id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (notion as any).dataSources.query({
    data_source_id: dsId,
    page_size: 100,
  });

  const results: SyncResult[] = [];

  for (const page of result.results as NotionPage[]) {
    const slug = extractSlug(page);
    if (!slug) continue;

    const coverUrl = extractCoverUrl(page);
    let source: "notion" | "static" = "notion";
    let fetchUrl = coverUrl;

    // No Notion cover — fall back to the static asset bundled in the worker.
    // This keeps the R2 bucket the single source of truth for tiles even
    // when an entry hasn't gotten a cover added in Notion yet. The static
    // files in public/images/ continue to act as a backstop in the repo.
    if (!fetchUrl) {
      source = "static";
    }

    try {
      const res =
        source === "static"
          ? // Use the ASSETS binding directly — fetch() from inside the
            // worker doesn't reliably hit the static asset handler.
            await (assets as { fetch: (url: string) => Promise<Response> }).fetch(
              `https://placeholder/harbour/images/${slug}.png`,
            )
          : await fetch(fetchUrl!);
      if (!res.ok) {
        results.push({
          slug,
          status: source === "static" ? "skipped-no-cover" : "failed",
          error: `${source} fetch ${res.status}`,
        });
        continue;
      }
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") ?? "image/png";

      await bucket.put(`${KEY_PREFIX}/${slug}.png`, buffer, {
        httpMetadata: { contentType },
      });
      results.push({ slug, status: "uploaded", bytes: buffer.byteLength });
    } catch (err) {
      results.push({
        slug,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const summary = {
    uploaded: results.filter((r) => r.status === "uploaded").length,
    skipped: results.filter((r) => r.status === "skipped-no-cover").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  console.log("[admin/sync-tiles]", JSON.stringify(summary));
  return NextResponse.json({ ok: true, summary, results });
}
