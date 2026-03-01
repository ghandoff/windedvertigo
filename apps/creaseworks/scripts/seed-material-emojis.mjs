#!/usr/bin/env node
/**
 * Seed emoji property on Notion materials pages.
 *
 * Reads all materials from Neon DB, resolves each title to an emoji
 * using the same cascading logic as getMaterialEmoji(), and patches
 * the Notion page's "emoji" rich_text property.
 *
 * This is a one-shot migration script — once emojis live in Notion,
 * edits happen there and flow through the normal sync pipeline.
 *
 * Usage: node scripts/seed-material-emojis.mjs
 *
 * Requires:
 *   POSTGRES_URL  — Neon connection string (from .env.local)
 *   NOTION_API_KEY — Notion integration token (from .env.local)
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { Client } from "@notionhq/client";

config({ path: ".env.local" });

/* ── env check ─────────────────────────────────────────────────────── */

const connStr = process.env.POSTGRES_URL;
if (!connStr) {
  console.error("❌  No POSTGRES_URL found in .env.local");
  process.exit(1);
}
const notionKey = process.env.NOTION_API_KEY;
if (!notionKey) {
  console.error("❌  No NOTION_API_KEY found in .env.local");
  process.exit(1);
}

const sql = neon(connStr);
const notion = new Client({ auth: notionKey });

/* ── emoji map (matches material-emoji.ts) ─────────────────────────── */

const MATERIAL_TITLE_EMOJI = {
  /* paper family */
  paper: "📄", newspaper: "📰", "tissue paper": "🧻",
  "wrapping paper": "🎁", "construction paper": "🟧", cardstock: "📋",
  "paper plate": "🍽️", "paper bag": "🛍️", "paper towel": "🧻",
  "coffee filter": "☕", magazine: "📖", envelope: "✉️",
  sticker: "⭐", stickers: "⭐",
  /* cardboard */
  cardboard: "📦", "cardboard box": "📦", "cereal box": "🥣",
  "egg carton": "🥚", "toilet paper roll": "🧻",
  "paper towel roll": "🌀", tube: "🌀", "cardboard tube": "🌀", box: "📦",
  /* fabric & fiber */
  fabric: "🧵", felt: "🧶", yarn: "🧶", string: "🧵", ribbon: "🎀",
  rope: "🪢", wool: "🧶", cotton: "☁️", "cotton balls": "☁️",
  "pipe cleaners": "〰️", "pipe cleaner": "〰️", burlap: "🧵",
  thread: "🪡", elastic: "➰", "rubber band": "➰", "rubber bands": "➰",
  cloth: "🧣", "old t-shirt": "👕", "t-shirt": "👕",
  sock: "🧦", socks: "🧦", "old sock": "🧦",
  button: "🔘", buttons: "🔘", bead: "🔮", beads: "🔮",
  /* wood & natural */
  wood: "🪵", stick: "🪵", sticks: "🪵", twig: "🌿", twigs: "🌿",
  "popsicle stick": "🍦", "popsicle sticks": "🍦",
  "craft stick": "🍦", "craft sticks": "🍦", "ice cream stick": "🍦",
  cork: "🍾", bamboo: "🎋", dowel: "🪵", bark: "🌳",
  pinecone: "🌲", pinecones: "🌲",
  leaf: "🍃", leaves: "🍂", flower: "🌸", flowers: "💐",
  petal: "🌸", petals: "🌸", seed: "🌱", seeds: "🌱",
  rock: "🪨", rocks: "🪨", stone: "🪨", stones: "🪨",
  pebble: "🪨", pebbles: "🪨", shell: "🐚", shells: "🐚",
  feather: "🪶", feathers: "🪶", sand: "🏖️", dirt: "🟫",
  soil: "🌱", mud: "🟫", moss: "🌿", grass: "🌾",
  acorn: "🌰", acorns: "🌰",
  /* plastic & containers */
  plastic: "🫙", "plastic bottle": "🍶", bottle: "🍶",
  "bottle cap": "⭕", "bottle caps": "⭕",
  cup: "🥤", cups: "🥤", "plastic cup": "🥤",
  straw: "🥤", straws: "🥤", container: "🫙",
  lid: "⭕", lids: "⭕", "yogurt cup": "🥛", bucket: "🪣",
  tray: "🍱", bag: "🛍️", "plastic bag": "🛍️", "zip bag": "🛍️",
  sponge: "🧽", "bubble wrap": "💭",
  /* metal */
  foil: "✨", "aluminum foil": "✨", "tin foil": "✨",
  wire: "〰️", "tin can": "🥫", can: "🥫",
  nail: "📌", nails: "📌", coin: "🪙", coins: "🪙",
  key: "🔑", spoon: "🥄",
  /* art supplies */
  paint: "🎨", marker: "🖍️", markers: "🖍️",
  crayon: "🖍️", crayons: "🖍️", pencil: "✏️", pencils: "✏️",
  "colored pencil": "🖍️", "colored pencils": "🖍️",
  chalk: "🩶", glitter: "✨", sequin: "💫", sequins: "💫",
  ink: "🖊️", stamp: "📮", stamps: "📮",
  /* adhesives & fasteners */
  tape: "🩹", "masking tape": "🩹", "duct tape": "🩹",
  "washi tape": "🎏", glue: "🫗", "glue stick": "🫗", "hot glue": "🔥",
  stapler: "📎", staples: "📎", "paper clip": "📎", "paper clips": "📎",
  pin: "📌", pins: "📌", velcro: "🔗",
  /* tools */
  scissors: "✂️", ruler: "📏", "hole punch": "⭕",
  /* food & kitchen */
  flour: "🌾", salt: "🧂", sugar: "🧂", "baking soda": "🧪",
  vinegar: "🧪", "food coloring": "🌈", rice: "🍚",
  pasta: "🍝", "dry pasta": "🍝", cereal: "🥣",
  marshmallow: "☁️", marshmallows: "☁️",
  toothpick: "🪥", toothpicks: "🪥", cookie: "🍪",
  fruit: "🍎", vegetable: "🥕", ice: "🧊", water: "💧",
  oil: "🫗", lemon: "🍋", egg: "🥚", bread: "🍞",
  dough: "🫓", "play dough": "🫓", playdough: "🫓",
  /* clay & modeling */
  clay: "🏺", "air dry clay": "🏺", "modeling clay": "🏺", plasticine: "🏺",
  /* recycled / found */
  "egg cartons": "🥚", "milk carton": "🥛", "juice box": "🧃",
  junk: "♻️", recycling: "♻️",
  /* misc */
  balloon: "🎈", balloons: "🎈", magnet: "🧲", magnets: "🧲",
  mirror: "🪞", candle: "🕯️", flashlight: "🔦", battery: "🔋",
  clothespin: "🪹", clothespins: "🪹", sponges: "🧽",
};

const FORM_FALLBACK_EMOJI = {
  paper: "📄", cardboard: "📦", fabric: "🧵", wood: "🪵",
  plastic: "🫙", metal: "🔩", natural: "🌿", food: "🍎",
  clay: "🏺", string: "🧶", tape: "🩹", paint: "🎨",
  recycled: "♻️", found: "🔍", adhesive: "🫗", tool: "🔧",
  fiber: "🧶", liquid: "💧", other: "✨",
};

/**
 * Replicate the cascading emoji resolution from material-emoji.ts.
 */
function resolveEmoji(title, formPrimary) {
  const lower = title.toLowerCase().trim();

  // 1. exact match
  if (MATERIAL_TITLE_EMOJI[lower]) return MATERIAL_TITLE_EMOJI[lower];

  // 2. partial match
  for (const [key, emoji] of Object.entries(MATERIAL_TITLE_EMOJI)) {
    if (lower.includes(key) || key.includes(lower)) return emoji;
  }

  // 3. form_primary fallback
  if (formPrimary) {
    const formLower = formPrimary.toLowerCase().trim();
    if (FORM_FALLBACK_EMOJI[formLower]) return FORM_FALLBACK_EMOJI[formLower];
    for (const [key, emoji] of Object.entries(FORM_FALLBACK_EMOJI)) {
      if (formLower.includes(key)) return emoji;
    }
  }

  // 4. ultimate fallback
  return "✨";
}

/* ── main ───────────────────────────────────────────────────────────── */

console.log("🔍  Fetching materials from Neon...");
const materials = await sql(
  `SELECT notion_id, title, form_primary FROM materials_cache ORDER BY title`,
);
console.log(`   Found ${materials.length} materials\n`);

let seeded = 0;
let fallback = 0;
let errors = 0;

// Notion rate limit: 3 req/s — use 350ms delay
const DELAY_MS = 350;

for (const mat of materials) {
  const emoji = resolveEmoji(mat.title, mat.form_primary);
  const isFallback = emoji === "✨";

  try {
    await notion.pages.update({
      page_id: mat.notion_id,
      properties: {
        emoji: {
          rich_text: [{ text: { content: emoji } }],
        },
      },
    });

    if (isFallback) {
      console.log(`  ⚠️  ${mat.title} → ${emoji} (fallback)`);
      fallback++;
    } else {
      console.log(`  ✅ ${mat.title} → ${emoji}`);
      seeded++;
    }
  } catch (err) {
    console.error(`  ❌ ${mat.title} — ${err.message}`);
    errors++;
  }

  await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`
📊  Summary:
   ${seeded} materials with matched emojis
   ${fallback} materials with fallback ✨
   ${errors} errors
   ${materials.length} total
`);
