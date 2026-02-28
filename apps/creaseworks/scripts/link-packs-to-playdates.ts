/**
 * Link pack pages to their playdates via the "playdates included" relation.
 *
 * This script:
 *   1. Sets "playdates included" on classroom starter, new baby sibling, summer play camp
 *   2. Sets "playdates included" on "the whole collection" with ALL ready playdates
 *   3. Cleans up orphaned empty collection entries
 *   4. Deletes the test multi-select page
 *
 * Usage:
 *   npx tsx scripts/link-packs-to-playdates.ts
 *
 * Prerequisites:
 *   - NOTION_API_KEY in .env.local
 *   - NOTION_DB_PLAYDATES in .env.local
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { Client } from "@notionhq/client";

// ── load .env.local ──────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("no .env.local found — relying on existing env vars");
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PLAYDATES_DB = process.env.NOTION_DB_PLAYDATES!;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Pack page IDs (from Notion packs database) ──────────────────────
const PACKS = {
  classroomStarter: "313e4ee7-4ba4-815e-b355-c2e620a9b720",
  newBabySibling: "313e4ee7-4ba4-81fe-852c-c46309eabd09",
  summerPlayCamp: "313e4ee7-4ba4-8135-9e8a-e7f913dc3095",
  theWholeCollection: "313e4ee7-4ba4-81c1-b87a-f57c7b21373f",
  rainyDayRescue: "313e4ee7-4ba4-8110-9ce0-fd8e327ea729",
};

// ── Playdate IDs for each pack ──────────────────────────────────────
const CLASSROOM_STARTER_PLAYDATES = [
  "314e4ee7-4ba4-8114-b39a-cb2a57fc39c3", // paper tower summit
  "314e4ee7-4ba4-8114-9918-d2477c009b16", // texture rubbing gallery
  "314e4ee7-4ba4-812c-80ed-c0df031cca29", // straw bridge challenge
  "314e4ee7-4ba4-8163-a202-ca88cc0f12fd", // paper plate masks
  "314e4ee7-4ba4-811c-a3df-f03be0ec6baa", // clipboard cartographer
  "314e4ee7-4ba4-811d-833a-ed01a6a7eed5", // tape road city
  "314e4ee7-4ba4-810e-a099-f996db617cad", // cup stack challenge
  "314e4ee7-4ba4-816b-9f73-ce072168327c", // shape sort relay
];

const NEW_BABY_SIBLING_PLAYDATES = [
  "314e4ee7-4ba4-8198-914b-cad1090f8865", // baby mobile builder
  "314e4ee7-4ba4-81e6-924b-cce484dba581", // lullaby shaker maker
  "314e4ee7-4ba4-81cc-bcc5-c239e015ad3f", // tiny sock puppet theater
  "314e4ee7-4ba4-8166-b3f6-e18b66b0a7d2", // peek-a-boo frame designer
];

const SUMMER_PLAY_CAMP_PLAYDATES = [
  "314e4ee7-4ba4-81a1-9a98-c7d232916779", // nature weave loom
  "314e4ee7-4ba4-815e-90f8-cfc9b346e93f", // mud kitchen menu
  "314e4ee7-4ba4-81a4-9262-e756c061be91", // splash target range
  "314e4ee7-4ba4-8102-be61-fceeed9b426c", // shadow tag arena
  "314e4ee7-4ba4-8122-bfb6-e90ecef90bce", // wind sock weather station
  "314e4ee7-4ba4-81c8-a6b2-ec608df0fb11", // fort blueprint builder
];

// ── Orphaned empty collection entries to delete ─────────────────────
const ORPHAN_COLLECTION_IDS = [
  "314e4ee7-4ba4-8115-9973-d8315988de17", // empty classroom starter
  "314e4ee7-4ba4-81be-bea3-eba2b8886119", // empty new baby sibling
  "314e4ee7-4ba4-8108-9998-cac02ed45c67", // empty summer play camp
];

// ── Test page to delete ─────────────────────────────────────────────
const TEST_PAGE_ID = "314e4ee7-4ba4-81dc-98f0-d8b2e995ce74";

// ── Fetch ALL ready playdates for "the whole collection" ────────────
async function fetchAllReadyPlaydateIds(): Promise<string[]> {
  console.log("[link] fetching all ready playdates...");
  const ids: string[] = [];
  let cursor: string | undefined = undefined;

  do {
    await delay(350);
    const response = await notion.databases.query({
      database_id: PLAYDATES_DB,
      start_cursor: cursor,
      page_size: 100,
      filter: {
        property: "status",
        status: { equals: "ready" },
      },
    });

    for (const page of response.results) {
      ids.push(page.id);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  console.log(`[link] found ${ids.length} ready playdates`);
  return ids;
}

// ── Update a pack page's "playdates included" relation ──────────────
async function linkPackToPlaydates(
  packPageId: string,
  playdateIds: string[],
  label: string,
) {
  await delay(350);
  await notion.pages.update({
    page_id: packPageId,
    properties: {
      "playdates included": {
        relation: playdateIds.map((id) => ({ id })),
      },
    },
  });
  console.log(`  ✓ ${label}: linked ${playdateIds.length} playdates`);
}

// ── Archive orphaned pages ──────────────────────────────────────────
async function archivePage(pageId: string, label: string) {
  await delay(350);
  await notion.pages.update({
    page_id: pageId,
    archived: true,
  });
  console.log(`  ✓ archived: ${label} (${pageId})`);
}

// ── main ─────────────────────────────────────────────────────────────
async function main() {
  console.log("[link] starting pack ↔ playdate linking...\n");

  // Step 1: Link individual packs to their playdates
  console.log("[link] step 1: linking individual packs...");
  await linkPackToPlaydates(
    PACKS.classroomStarter,
    CLASSROOM_STARTER_PLAYDATES,
    "classroom starter",
  );
  await linkPackToPlaydates(
    PACKS.newBabySibling,
    NEW_BABY_SIBLING_PLAYDATES,
    "new baby sibling",
  );
  await linkPackToPlaydates(
    PACKS.summerPlayCamp,
    SUMMER_PLAY_CAMP_PLAYDATES,
    "summer play camp",
  );

  // Step 2: Get ALL ready playdates and link to "the whole collection"
  console.log("\n[link] step 2: linking the whole collection...");
  const allPlaydateIds = await fetchAllReadyPlaydateIds();
  await linkPackToPlaydates(
    PACKS.theWholeCollection,
    allPlaydateIds,
    "the whole collection",
  );

  // Step 3: Clean up orphaned empty collection entries
  console.log("\n[link] step 3: archiving orphaned collection entries...");
  for (const id of ORPHAN_COLLECTION_IDS) {
    try {
      await archivePage(id, `orphan collection ${id.slice(-8)}`);
    } catch (err: any) {
      console.log(`  ⚠ skipped ${id.slice(-8)}: ${err?.message ?? err}`);
    }
  }

  // Step 4: Archive test page
  console.log("\n[link] step 4: archiving test page...");
  try {
    await archivePage(TEST_PAGE_ID, "test multi select");
  } catch (err: any) {
    console.log(`  ⚠ skipped test page: ${err?.message ?? err}`);
  }

  console.log("\n[link] ✅ done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("[link] failed:", err);
  process.exit(1);
});
