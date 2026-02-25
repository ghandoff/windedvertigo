/**
 * Populate Notion with collections and keyword-matched playdates.
 *
 * This script:
 *   1. Creates the "creaseworks — collections" database in Notion (if needed)
 *   2. Fetches all ready playdates from the Notion playdates DB
 *   3. Keyword-matches playdates into themed collections
 *   4. Creates/updates collection pages with the playdates relation set
 *
 * Idempotent — re-running updates existing pages rather than duplicating.
 *
 * Usage:
 *   npx tsx scripts/populate-notion-collections.ts
 *
 * Prerequisites:
 *   - NOTION_API_KEY in .env.local
 *   - NOTION_DB_PLAYDATES in .env.local
 *   - NOTION_DB_COLLECTIONS in .env.local (set after first run creates the DB)
 */

import { readFileSync, writeFileSync } from "fs";
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

// ── parent page: "components" ────────────────────────────────────────
// The "creaseworks" section is a toggle block that cannot contain new
// databases via the API.  We create under "components" (the actual page)
// and can move it into the toggle later from the Notion UI if desired.
const COMPONENTS_PARENT_PAGE = "28ce4ee7-4ba4-804c-8835-c8db639d2f25";

// ── collection definitions with keyword rules ────────────────────────
const COLLECTIONS = [
  {
    title: "puddle scientists",
    icon: "🔬",
    desc: "splashing with purpose — pouring, mixing, freezing, and watching what happens when water meets everything else",
    sort: 1,
    keywords: [
      "water", "puddle", "mud", "rain", "splash", "pour", "float", "sink",
      "ice", "melt", "bubble", "wet", "outdoor", "nature", "garden", "plant",
      "bug", "worm", "dig", "sand", "dirt", "mess", "paint", "color", "mix",
      "experiment", "science", "explore", "discover",
    ],
  },
  {
    title: "cardboard architects",
    icon: "📦",
    desc: "towers, tunnels, and tiny cities — turning boxes and tape into buildings that test gravity and imagination",
    sort: 2,
    keywords: [
      "build", "cardboard", "box", "tower", "bridge", "fort", "house",
      "stack", "block", "construct", "structure", "shape", "fold", "paper",
      "tape", "cut", "design", "plan", "balance", "tall", "architect",
      "sculpture", "model",
    ],
  },
  {
    title: "kitchen explorers",
    icon: "🍳",
    desc: "measuring, mixing, tasting, and discovering why bread rises — chemistry you can eat",
    sort: 3,
    keywords: [
      "cook", "kitchen", "bake", "recipe", "food", "taste", "smell",
      "measure", "stir", "dough", "bread", "snack", "fruit", "veggie",
      "ingredient", "sensory", "texture", "spice", "sweet", "sour",
    ],
  },
  {
    title: "sidewalk neighbors",
    icon: "🏘️",
    desc: "chalk maps, trading games, and front-yard invitations — play that turns strangers into friends",
    sort: 4,
    keywords: [
      "friend", "share", "neighbor", "community", "chalk", "sidewalk",
      "social", "together", "group", "team", "turn", "rule", "game",
      "pretend", "role", "story", "tell", "listen", "talk", "cooperat",
      "negotiate", "map", "walk", "neighborhood",
    ],
  },
  {
    title: "rhythm makers",
    icon: "🥁",
    desc: "drums from tins, shakers from rice, dances from nowhere — finding the beat in everything around you",
    sort: 5,
    keywords: [
      "drum", "rhythm", "music", "sound", "beat", "clap", "shake",
      "rattle", "sing", "song", "dance", "move", "body", "stomp", "tap",
      "pattern", "repeat", "loud", "quiet", "tempo", "instrument",
    ],
  },
  {
    title: "tiny engineers",
    icon: "⚙️",
    desc: "pulleys, levers, ramps, and rubber bands — figuring out how things work by taking them apart and building new ones",
    sort: 6,
    keywords: [
      "wheel", "ramp", "gear", "pulley", "lever", "machine", "robot",
      "magnet", "electric", "circuit", "fix", "tool", "tinker",
      "take apart", "cause", "effect", "push", "pull", "roll", "spin",
      "mechanism", "invent", "launch", "catapult",
    ],
  },
];

// ── rate limit helper ────────────────────────────────────────────────
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── step 1: ensure the database exists ───────────────────────────────
async function ensureDatabase(): Promise<string> {
  const existing = process.env.NOTION_DB_COLLECTIONS;
  if (existing) {
    console.log(`[populate] using existing collections DB: ${existing}`);
    return existing;
  }

  console.log("[populate] creating creaseworks — collections database...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: COMPONENTS_PARENT_PAGE },
    title: [{ type: "text", text: { content: "creaseworks — collections" } }],
    properties: {
      collection: { title: {} },
      description: { rich_text: {} },
      icon: { rich_text: {} },
      "sort order": { number: { format: "number" } },
      status: {
        select: {
          options: [
            { name: "ready", color: "green" },
            { name: "draft", color: "default" },
          ],
        },
      },
      playdates: {
        relation: {
          database_id: PLAYDATES_DB,
          type: "dual_property",
          dual_property: {},
        },
      },
    },
  });

  const dbId = db.id;
  console.log(`[populate] created database: ${dbId}`);
  console.log(`[populate] ➜ add to .env.local: NOTION_DB_COLLECTIONS=${dbId}`);

  // Auto-append to .env.local
  try {
    const content = readFileSync(envPath, "utf-8");
    if (!content.includes("NOTION_DB_COLLECTIONS")) {
      writeFileSync(envPath, content.trimEnd() + `\nNOTION_DB_COLLECTIONS=${dbId}\n`);
      console.log("[populate] ✓ appended to .env.local");
    }
  } catch {
    // fine — user can add manually
  }

  return dbId;
}

// ── step 2: fetch all ready playdates from Notion ────────────────────
async function fetchPlaydates(): Promise<Array<{ id: string; title: string }>> {
  console.log("[populate] fetching playdates from Notion...");
  const results: Array<{ id: string; title: string }> = [];
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

    for (const page of response.results as any[]) {
      const titleParts = page.properties?.playdate?.title ?? [];
      const title = titleParts.map((t: any) => t.plain_text).join("").toLowerCase().trim();
      results.push({ id: page.id, title });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  console.log(`[populate] found ${results.length} ready playdates`);
  return results;
}

// ── step 3: keyword-match ────────────────────────────────────────────
function matchPlaydates(
  playdates: Array<{ id: string; title: string }>,
): Map<number, string[]> {
  const assignments = new Map<number, string[]>();
  for (let i = 0; i < COLLECTIONS.length; i++) {
    assignments.set(i, []);
  }

  const assigned = new Set<string>();

  for (const p of playdates) {
    const text = p.title.toLowerCase();
    for (let i = 0; i < COLLECTIONS.length; i++) {
      const match = COLLECTIONS[i].keywords.some((kw) => text.includes(kw));
      if (match) {
        assignments.get(i)!.push(p.id);
        assigned.add(p.id);
      }
    }
  }

  // Round-robin unmatched playdates
  let rrIdx = 0;
  for (const p of playdates) {
    if (!assigned.has(p.id)) {
      const collIdx = rrIdx % COLLECTIONS.length;
      assignments.get(collIdx)!.push(p.id);
      rrIdx++;
    }
  }

  return assignments;
}

// ── step 4: create/update Notion pages ───────────────────────────────
async function populateCollections(
  dbId: string,
  assignments: Map<number, string[]>,
) {
  // First fetch existing pages to enable idempotent updates
  const existing = new Map<string, string>(); // title → pageId
  let cursor: string | undefined = undefined;
  do {
    await delay(350);
    const response = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of response.results as any[]) {
      const titleParts = page.properties?.collection?.title ?? [];
      const title = titleParts.map((t: any) => t.plain_text).join("").toLowerCase().trim();
      if (title) existing.set(title, page.id);
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  for (let i = 0; i < COLLECTIONS.length; i++) {
    const coll = COLLECTIONS[i];
    const playdateIds = assignments.get(i) ?? [];
    const pageId = existing.get(coll.title.toLowerCase());

    const properties: any = {
      collection: { title: [{ text: { content: coll.title } }] },
      description: { rich_text: [{ text: { content: coll.desc } }] },
      icon: { rich_text: [{ text: { content: coll.icon } }] },
      "sort order": { number: coll.sort },
      status: { select: { name: "ready" } },
      playdates: { relation: playdateIds.map((id) => ({ id })) },
    };

    await delay(350);

    if (pageId) {
      // Update existing
      await notion.pages.update({ page_id: pageId, properties, icon: { type: "emoji", emoji: coll.icon as any } });
      console.log(`  ✓ updated ${coll.icon} ${coll.title} (${playdateIds.length} playdates)`);
    } else {
      // Create new
      await notion.pages.create({
        parent: { database_id: dbId },
        icon: { type: "emoji", emoji: coll.icon as any },
        properties,
      });
      console.log(`  ✓ created ${coll.icon} ${coll.title} (${playdateIds.length} playdates)`);
    }
  }
}

// ── main ─────────────────────────────────────────────────────────────
async function main() {
  console.log("[populate] starting collection population...\n");

  const dbId = await ensureDatabase();
  const playdates = await fetchPlaydates();
  const assignments = matchPlaydates(playdates);

  console.log("\n[populate] assignment summary:");
  for (let i = 0; i < COLLECTIONS.length; i++) {
    const count = assignments.get(i)?.length ?? 0;
    console.log(`  ${COLLECTIONS[i].icon} ${COLLECTIONS[i].title}: ${count} playdates`);
  }

  console.log("\n[populate] writing to Notion...");
  await populateCollections(dbId, assignments);

  console.log(`\n[populate] done — ${COLLECTIONS.length} collections populated`);
  console.log(`[populate] database ID: ${dbId}`);
  console.log(`[populate] next: run the sync to pull into postgres`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[populate] failed:", err);
  process.exit(1);
});
