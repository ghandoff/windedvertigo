#!/usr/bin/env node
/**
 * sync-harbour-tiles.mjs
 *
 * Downloads cover images from every page in the Notion "harbour games"
 * database and saves them to harbour/public/images/{slug}.png.
 *
 * Notion signed URLs expire in ~1 hour, so we persist the images as
 * static files. Run this script whenever a cover image changes in Notion.
 *
 * Usage:
 *   node scripts/sync-harbour-tiles.mjs
 *
 * Requires NOTION_TOKEN in env or harbour/.env.production.
 * Uses the Notion REST API directly (no SDK dependency).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "harbour", "public", "images");
const DB_ID = "8e3f3364b2654640a91ed0f38b091a07";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ── load env ────────────────────────────────────────────
function loadEnv() {
  if (process.env.NOTION_TOKEN) return;
  const envPath = path.join(ROOT, "harbour", ".env.production");
  if (!fs.existsSync(envPath)) {
    console.error("NOTION_TOKEN not set and harbour/.env.production not found");
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const headers = {
  Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
};

// ── notion helpers ──────────────────────────────────────
async function queryDatabase() {
  const res = await fetch(`${NOTION_API}/databases/${DB_ID}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sorts: [{ property: "Order", direction: "ascending" }],
    }),
  });
  if (!res.ok) throw new Error(`Notion API error: ${res.status} ${await res.text()}`);
  return res.json();
}

function getText(prop) {
  if (!prop) return "";
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("");
  if (prop.type === "title") return prop.title.map((t) => t.plain_text).join("");
  return "";
}

// ── main ────────────────────────────────────────────────
async function main() {
  console.log("fetching harbour games from Notion...\n");

  const data = await queryDatabase();
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  let synced = 0;
  let skipped = 0;

  for (const page of data.results) {
    if (!page.properties) continue;

    const slug = getText(page.properties["Slug"]);
    const name = getText(page.properties["Name"]) || slug;
    if (!slug) continue;

    const cover = page.cover;
    if (!cover) {
      console.log(`  \u2298 ${name} \u2014 no cover image, skipping`);
      skipped++;
      continue;
    }

    const url =
      cover.type === "file"
        ? cover.file.url
        : cover.type === "external"
          ? cover.external.url
          : null;

    if (!url) {
      console.log(`  \u2298 ${name} \u2014 unrecognized cover type, skipping`);
      skipped++;
      continue;
    }

    const dest = path.join(IMAGES_DIR, `${slug}.png`);

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        console.log(`  \u2717 ${name} \u2014 HTTP ${res.status}`);
        skipped++;
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      console.log(`  \u2713 ${name} \u2192 ${path.relative(ROOT, dest)} (${(buffer.length / 1024).toFixed(0)} KB)`);
      synced++;
    } catch (err) {
      console.log(`  \u2717 ${name} \u2014 ${err.message}`);
      skipped++;
    }
  }

  console.log(`\ndone: ${synced} synced, ${skipped} skipped`);
}

main().catch((err) => {
  console.error("sync failed:", err);
  process.exit(1);
});
