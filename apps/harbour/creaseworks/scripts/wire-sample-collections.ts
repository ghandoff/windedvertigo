/**
 * Wire patterns into collections with keyword-based matching.
 *
 * Assigns each ready pattern to one or more collections based on
 * title/slug keywords. Patterns that don't match any collection
 * are round-robin distributed so every collection has content.
 *
 * Usage: npx tsx scripts/wire-sample-collections.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
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

import { sql } from "@vercel/postgres";

const RULES = [
  {
    coll: "puddle-scientists",
    keywords: [
      "water", "puddle", "mud", "rain", "splash", "pour", "float", "sink",
      "ice", "melt", "bubble", "wet", "outdoor", "nature", "garden", "plant",
      "bug", "worm", "dig", "sand", "dirt", "mess", "paint", "color", "mix",
      "experiment", "science", "explore", "discover",
    ],
  },
  {
    coll: "cardboard-architects",
    keywords: [
      "build", "cardboard", "box", "tower", "bridge", "fort", "house",
      "stack", "block", "construct", "structure", "shape", "fold", "paper",
      "tape", "cut", "design", "plan", "balance", "tall", "architect",
      "sculpture", "model",
    ],
  },
  {
    coll: "kitchen-explorers",
    keywords: [
      "cook", "kitchen", "bake", "recipe", "food", "taste", "smell",
      "measure", "stir", "dough", "bread", "snack", "fruit", "veggie",
      "ingredient", "sensory", "texture", "spice", "sweet", "sour",
    ],
  },
  {
    coll: "sidewalk-neighbors",
    keywords: [
      "friend", "share", "neighbor", "community", "chalk", "sidewalk",
      "social", "together", "group", "team", "turn", "rule", "game",
      "pretend", "role", "story", "tell", "listen", "talk", "cooperat",
      "negotiate", "map", "walk", "neighborhood",
    ],
  },
  {
    coll: "rhythm-makers",
    keywords: [
      "drum", "rhythm", "music", "sound", "beat", "clap", "shake",
      "rattle", "sing", "song", "dance", "move", "body", "stomp", "tap",
      "pattern", "repeat", "loud", "quiet", "tempo", "instrument",
    ],
  },
  {
    coll: "tiny-engineers",
    keywords: [
      "wheel", "ramp", "gear", "pulley", "lever", "machine", "robot",
      "magnet", "electric", "circuit", "fix", "tool", "tinker",
      "take apart", "cause", "effect", "push", "pull", "roll", "spin",
      "mechanism", "invent", "launch", "catapult",
    ],
  },
];

async function main() {
  console.log("[wire] fetching patterns and collections...");

  const { rows: patterns } = await sql.query(
    `SELECT id, title, slug FROM patterns_cache WHERE status = 'ready' ORDER BY title ASC`,
  );
  console.log(`  ${patterns.length} ready patterns`);

  const { rows: collections } = await sql.query(
    `SELECT id, slug, title FROM collections ORDER BY sort_order ASC`,
  );
  const collMap: Record<string, string> = {};
  for (const c of collections) {
    collMap[c.slug] = c.id;
  }
  console.log(`  ${collections.length} collections`);

  // Clear existing assignments so this is idempotent
  await sql.query(`DELETE FROM collection_patterns`);

  let assignCount = 0;
  let roundRobinIdx = 0;

  for (const p of patterns) {
    const text = (p.title + " " + p.slug).toLowerCase();
    let assigned = false;

    for (const rule of RULES) {
      const collId = collMap[rule.coll];
      if (!collId) continue;

      const match = rule.keywords.some((kw) => text.includes(kw));
      if (match) {
        await sql.query(
          `INSERT INTO collection_patterns (collection_id, pattern_id, display_order)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [collId, p.id, assignCount],
        );
        assigned = true;
        assignCount++;
      }
    }

    // round-robin fallback so every pattern shows up somewhere
    if (!assigned) {
      const collId = collections[roundRobinIdx % collections.length].id;
      await sql.query(
        `INSERT INTO collection_patterns (collection_id, pattern_id, display_order)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [collId, p.id, assignCount],
      );
      assignCount++;
      roundRobinIdx++;
    }
  }

  console.log(`\n  ✓ ${assignCount} total assignments\n`);

  // verify
  const { rows: counts } = await sql.query(
    `SELECT c.icon_emoji, c.title, COUNT(cp.pattern_id) AS n
     FROM collections c
     LEFT JOIN collection_patterns cp ON cp.collection_id = c.id
     GROUP BY c.id, c.icon_emoji, c.title, c.sort_order
     ORDER BY c.sort_order`,
  );
  for (const row of counts) {
    console.log(`  ${row.icon_emoji} ${row.title}: ${row.n} patterns`);
  }

  console.log("\n[wire] done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[wire] failed:", err);
  process.exit(1);
});
