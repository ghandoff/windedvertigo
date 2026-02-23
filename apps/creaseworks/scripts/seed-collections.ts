/**
 * Seed script: populate initial collections.
 *
 * Run once after migration 013. Pattern-to-collection assignments
 * are left empty — the collective decides which playdates belong where.
 *
 * Usage: npx tsx scripts/seed-collections.ts
 */

import { sql } from "@vercel/postgres";
import { makeSlug } from "../src/lib/slugify";

const SEED = [
  {
    title: "puddle scientists",
    icon: "🔬",
    desc: "water play, outdoor exploration, messy experimentation",
    sort: 1,
  },
  {
    title: "cardboard architects",
    icon: "📦",
    desc: "building, structural play, spatial reasoning",
    sort: 2,
  },
  {
    title: "kitchen explorers",
    icon: "🍳",
    desc: "cooking, sensory, measurement, chemistry-through-baking",
    sort: 3,
  },
  {
    title: "sidewalk neighbors",
    icon: "🏘️",
    desc: "social play, community, negotiation, public space",
    sort: 4,
  },
  {
    title: "rhythm makers",
    icon: "🥁",
    desc: "sound, music, pattern, movement",
    sort: 5,
  },
  {
    title: "tiny engineers",
    icon: "⚙️",
    desc: "mechanisms, cause-and-effect, tinkering",
    sort: 6,
  },
];

async function main() {
  console.log("[seed] inserting collections...");

  for (const c of SEED) {
    const slug = makeSlug(c.title);
    await sql.query(
      `INSERT INTO collections (title, description, icon_emoji, slug, sort_order, status)
       VALUES ($1, $2, $3, $4, $5, 'ready')
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         icon_emoji = EXCLUDED.icon_emoji,
         sort_order = EXCLUDED.sort_order`,
      [c.title, c.desc, c.icon, slug, c.sort],
    );
    console.log(`  ✓ ${c.icon} ${c.title}`);
  }

  console.log(`[seed] done — ${SEED.length} collections upserted`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
