/**
 * Sync harbour tile cover images from Notion → R2.
 *
 * For each row in the harbour-games Notion database:
 *   1. Read the page cover URL (Notion serves a fresh signed URL on every
 *      API call, so URL expiry isn't a problem during this script's run)
 *   2. Download the image
 *   3. Upload to R2 at `harbour-tiles/{slug}.png`
 *
 * Then harbour's runtime reads `R2_PUBLIC_URL/harbour-tiles/{slug}.png` and
 * serves the image directly from R2 — no Notion dependency at request time.
 *
 * Usage (from apps/harbour/):
 *   node scripts/sync-tiles-to-r2.mjs
 *
 * Required env vars:
 *   NOTION_TOKEN           — Notion integration token
 *   R2_ACCOUNT_ID          — Cloudflare account ID (e.g. 097c92553b...)
 *   R2_ACCESS_KEY_ID       — R2 S3-compat access key
 *   R2_SECRET_ACCESS_KEY   — R2 S3-compat secret
 *
 * Use --force to re-sync every tile (otherwise unchanged covers are skipped).
 */

import { Client } from "@notionhq/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const NOTION_DB_HARBOUR_GAMES = "8e3f3364b2654640a91ed0f38b091a07";
const R2_BUCKET = "creaseworks-evidence";
const KEY_PREFIX = "harbour-tiles";

const force = process.argv.includes("--force");

if (!process.env.NOTION_TOKEN) {
  console.error("NOTION_TOKEN is required");
  process.exit(1);
}
if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY are required");
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// v5 client: discover the data source ID once
async function getDataSourceId(databaseId) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in db) || db.data_sources.length === 0) {
    throw new Error(`no data sources for database ${databaseId}`);
  }
  return db.data_sources[0].id;
}

function extractSlug(page) {
  const slugProp = page.properties?.Slug;
  if (slugProp?.type === "rich_text" && slugProp.rich_text.length > 0) {
    return slugProp.rich_text.map((r) => r.plain_text).join("");
  }
  return null;
}

function extractCoverUrl(page) {
  const cover = page.cover;
  if (!cover) return null;
  if (cover.type === "external") return cover.external.url;
  if (cover.type === "file") return cover.file.url;
  return null;
}

async function uploadToR2(slug, body, contentType) {
  const key = `${KEY_PREFIX}/${slug}.png`;
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType ?? "image/png",
    }),
  );
  return key;
}

async function main() {
  const dsId = await getDataSourceId(NOTION_DB_HARBOUR_GAMES);
  const result = await notion.dataSources.query({ data_source_id: dsId, page_size: 100 });

  console.log(`[sync-tiles] found ${result.results.length} games`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const page of result.results) {
    if (!("properties" in page)) continue;
    const slug = extractSlug(page);
    if (!slug) {
      console.warn(`  ! skipping ${page.id}: no slug`);
      continue;
    }

    const coverUrl = extractCoverUrl(page);
    if (!coverUrl) {
      console.log(`  - ${slug}: no cover in Notion (skipped)`);
      skipped++;
      continue;
    }

    try {
      const res = await fetch(coverUrl);
      if (!res.ok) {
        console.warn(`  ! ${slug}: notion fetch ${res.status}`);
        failed++;
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "image/png";

      const key = await uploadToR2(slug, buffer, contentType);
      console.log(`  ✓ ${slug}: uploaded to ${key} (${buffer.length} bytes)`);
      synced++;
    } catch (err) {
      console.error(`  ! ${slug}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`[sync-tiles] done — synced: ${synced}, skipped: ${skipped}, failed: ${failed}`);
}

main().catch((err) => {
  console.error("[sync-tiles] fatal:", err);
  process.exit(1);
});
