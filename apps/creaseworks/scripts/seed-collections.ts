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
    desc: "splashing with purpose — pouring, mixing, freezing, and watching what happens when water meets everything else",
    sort: 1,
  },
  {
    title: "cardboard architects",
    icon: "📦",
    desc: "towers, tunnels, and tiny cities — turning boxes and tape into buildings that test gravity and imagination",
    sort: 2,
  },
  {
    title: "kitchen explorers",
    icon: "🍳",
    desc: "measuring, mixing, tasting, and discovering why bread rises — chemistry you can eat",
    sort: 3,
  },
  {
    title: "sidewalk neighbors",
    icon: "🏘️",
    desc: "chalk maps, trading games, and front-yard invitations — play that turns strangers into friends",
    sort: 4,
  },
  {
    title: "rhythm makers",
    icon: "🥁",
    desc: "drums from tins, shakers from rice, dances from nowhere — finding the beat in everything around you",
    sort: 5,
  },
  {
    title: "tiny engineers",
    icon: "⚙️",
    desc: "pulleys, levers, ramps, and rubber bands — figuring out how things work by taking them apart and building new ones",
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
