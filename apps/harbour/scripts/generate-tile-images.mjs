#!/usr/bin/env node
/**
 * generate-tile-images.mjs
 *
 * Generates 19 harbour tile images via OpenAI's gpt-image-1 model
 * (or Google Imagen 4) and saves them to a STAGING folder:
 * apps/harbour/public/images/_generated/{slug}.png
 *
 * The harbour hub reads from apps/harbour/public/images/{slug}.png,
 * so generated tiles do NOT replace existing ones. Review side-by-side
 * and manually move the keepers up one level.
 *
 * Why gpt-image-1 over dall-e-3:
 *   - much stronger prompt adherence on detailed compositional instructions
 *   - reliably honours "no text, no logos, editorial illustration" guidance
 *   - returns base64 directly (no signed URL with expiry to wrangle)
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-tile-images.mjs
 *   GEMINI_API_KEY=AIza... node scripts/generate-tile-images.mjs --provider imagen
 *   node scripts/generate-tile-images.mjs --slug creaseworks --provider imagen
 *
 * Flags:
 *   --provider <openai|imagen>   default: openai (gpt-image-1). imagen uses Google Imagen 3.
 *   --slug <slug>        only generate one tile (matches the slug field below)
 *   --quality <low|med|high>   default: high. (openai only — imagen has no quality tiers.)
 *   --dry-run            print prompts and exit, no API calls
 *
 * Cost reference (1024x1024):
 *   low:  19 × $0.04 ≈ $0.76
 *   med:  19 × $0.07 ≈ $1.33
 *   high: 19 × $0.17 ≈ $3.23   ← default
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
// Write to a staging subfolder so we never overwrite existing tiles.
// Review the output side-by-side with the current images, then manually
// move the keepers up one level into apps/harbour/public/images/.
const OUTPUT_DIR = join(REPO_ROOT, "apps/harbour/public/images/_generated");

// ── shared style baseline (prepended to every prompt) ─────────
const STYLE_BASELINE = `Bright daylight palette: warm cream background (#fdf6e8), with accents in soft turquoise (#7dd3c0), warm coral (#ff8a65), butter yellow (#ffd54f), and sky blue (#90caf9). Playful but not cartoony — illustrated editorial style with clean linework, gentle gradients, and subtle paper-grain texture. Square composition. No text, no UI chrome, no logos. Avoid cluttered or dark scenes.`;

// ── per-tile prompts ─────────────────────────────────────────
// Each entry: { slug, name, visual } — visual is the architecture + per-tile palette.
// The 3-sentence "what it does" descriptions live in docs/tile-image-prompts.md
// for human reference; the API prompt only needs the visual instructions.
const TILES = [
  { slug: "creaseworks", name: "creaseworks",
    visual: "Three folded paper cranes mid-flight above an open notebook on a sunlit table. The notebook page shows a half-finished pencil sketch and a scatter of coloured pencil shavings. Soft window light from the upper left casts gentle shadows. Cranes in coral and turquoise, pencils in butter yellow and sky blue." },
  { slug: "vertigo-vault", name: "vertigo.vault",
    visual: "A tall apothecary cabinet with many small drawers, each slightly ajar. Coloured paper cards spill out of two drawers and float gently upward, sorted by hue. A magnifying glass rests in front of the cabinet. Pale wood cabinet, cards in turquoise, coral, butter yellow, and sky blue." },
  { slug: "depth-chart", name: "depth.chart",
    visual: "A nautical depth-sounding chart unfurled on a desk, with delicate contour lines forming concentric ridges. A brass plumb line dangles from above, casting a thin shadow across the lines. Three small flag markers stand at different depths. Soft turquoise contour lines, coral flags, butter yellow plumb line, with a subtle paper-fold crease running diagonally." },
  { slug: "deep-deck", name: "deep.deck",
    visual: "A loose fan of oversized playing cards spread across a tabletop, each card showing a different abstract symbol (a spiral, a knot, an open hand, a doorway). The top card stands upright, balanced on its edge. Cards in alternating turquoise and coral with butter yellow symbols." },
  { slug: "raft-house", name: "raft.house",
    visual: "A wooden raft made of mismatched planks, floating on calm turquoise water. Three small paper sails rise from the raft, each tied to a different plank. A line of bubbles trails behind it. Sails in coral, butter yellow, and sky blue. Sunny, optimistic." },
  { slug: "tidal-pool", name: "tidal.pool",
    visual: "A top-down view of a small rocky tide pool with three or four sea creatures (a starfish, an anemone, a tiny fish), surrounded by ripples that radiate outward in concentric rings. A single droplet falls from above, frozen mid-fall. Cream rocks, turquoise water, coral starfish, butter yellow anemone, sky blue ripples." },
  { slug: "paper-trail", name: "paper.trail",
    visual: "A trail of small paper notes pinned along a clothesline, each note showing a different doodle or scrap of handwriting. A wooden clothespin holds the centre note slightly askew. Three more notes drift in the breeze just beyond the line. Butter yellow line, notes in pale turquoise, coral, and sky blue." },
  { slug: "mirror-log", name: "mirror.log",
    visual: "An open hand-mirror lying face-up on an open journal, with the mirror's reflection showing not the ceiling but a calm sky with one cloud. A fountain pen rests beside the journal, cap off, ink slightly bleeding into the page. Mirror frame in warm coral, sky reflection in pale turquoise and sky blue, pen in butter yellow." },
  { slug: "orbit-lab", name: "orbit.lab",
    visual: "A small turquoise planet at centre of a cream space background (not black — bright and airy), with a single coral orbiter drawing a delicate elliptical trail around it. A second, fainter butter-yellow trail shows an earlier failed attempt that escaped to the right. Three tiny stars dot the background. Subtle motion blur on the orbiter." },
  { slug: "proof-garden", name: "proof.garden",
    visual: "A small potted plant whose stems and branches form a clear tree diagram, each leaf labelled with a tiny abstract symbol. New buds at the top of the plant glow faintly. A watering can sits beside the pot. Terracotta pot in warm coral, leaves in turquoise and sky blue, buds in butter yellow." },
  { slug: "bias-lens", name: "bias.lens",
    visual: "A pair of round eyeglasses lying on a cream surface, with each lens showing a slightly different distorted version of the same simple scene (three coloured shapes). One lens stretches the shapes; the other tints them. Glasses frames in coral, lenses with subtle turquoise and butter yellow tints, shapes in sky blue and coral." },
  { slug: "scale-shift", name: "scale.shift",
    visual: "A series of five concentric circles nested inside each other, each containing a different recognisable form (a hexagon, a leaf, a hand, a planet, a spiral galaxy). A subtle dotted line spirals outward through all five. Concentric circles in alternating turquoise, coral, butter yellow, sky blue, and pale turquoise." },
  { slug: "pattern-weave", name: "pattern.weave",
    visual: "A woven textile fragment where the warp threads form one image (a bird) and the weft threads form another (a fish), with the eye able to flip between the two depending on focus. A loose thread curls off the edge. Warp threads in turquoise, weft threads in coral, accent threads in butter yellow and sky blue." },
  { slug: "market-mind", name: "market.mind",
    visual: "A balance scale with two pans, each holding a small stack of coloured tokens. A faint ghostly outline of additional tokens hovers above each pan, showing what could have been placed there. The fulcrum is gently tilted. Scale in warm coral, real tokens in turquoise and butter yellow, ghost tokens in pale sky blue with low opacity." },
  { slug: "rhythm-lab", name: "rhythm.lab",
    visual: "A 4×4 grid of round buttons, with about half lit up in different colours, arranged in a clearly rhythmic pattern. Three small concentric rings emanate from one of the lit buttons as if a sound just played. Lit buttons in coral, turquoise, butter yellow, and sky blue, unlit buttons in pale cream-grey." },
  { slug: "code-weave", name: "code.weave",
    visual: "A delicate tree-diagram that branches downward, with each node connected to two smaller children, fading from solid colour at the top to soft sketch at the bottom. A single highlighted path runs from root to one leaf. Tree nodes in turquoise circles, branches in coral, highlighted path in butter yellow, leaves in sky blue." },
  { slug: "time-prism", name: "time.prism",
    visual: "A simple triangular glass shape resting on a cream surface, with three coloured ribbons fanning outward from one edge. Each ribbon ends at a small hand-drawn icon: a key, an envelope, and a compass. Ribbons in coral, butter yellow, and turquoise. Icons outlined in sky blue. Soft flat illustration, no photorealism." },
  { slug: "liminal-pass", name: "liminal.pass",
    visual: "A simple stone archway standing alone in an open space, with light streaming through it from the far side. The ground on the near side is muted; the ground visible through the archway is brighter and more colourful, as if a different world begins on the other side. Archway in warm coral stone, near-side ground in muted sky blue, far-side ground glowing in butter yellow and turquoise. Soft volumetric light." },
  { slug: "emerge-box", name: "emerge.box",
    visual: "A grid of small square cells, with about a quarter of them lit up in a pattern that looks midway through evolving — recognisable shapes (a glider, a blinker, a small cluster) dotted across the field. A faint trail shows where one shape just moved. Lit cells in turquoise, coral, butter yellow, and sky blue, with the moving glider trail in pale coral." },
];

// ── arg parsing ──────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);

const onlySlug = flag("--slug");
const quality = flag("--quality") || "high"; // low | medium | high
const provider = flag("--provider") || "openai"; // openai | imagen
const dryRun = has("--dry-run");

if (!["openai", "imagen"].includes(provider)) {
  console.error(`error: --provider must be one of: openai, imagen (got "${provider}")`);
  process.exit(1);
}
if (!["low", "medium", "high"].includes(quality)) {
  console.error(`error: --quality must be one of: low, medium, high (got "${quality}")`);
  process.exit(1);
}

const openaiKey = process.env.OPENAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!dryRun) {
  if (provider === "openai" && !openaiKey) {
    console.error("error: OPENAI_API_KEY env var is required for --provider openai");
    process.exit(1);
  }
  if (provider === "imagen" && !geminiKey) {
    console.error("error: GEMINI_API_KEY env var is required for --provider imagen");
    process.exit(1);
  }
}

async function generateOpenAi(fullPrompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: fullPrompt,
      size: "1024x1024",
      quality,
      n: 1,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no image in response");
  return b64;
}

async function generateImagen(fullPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${geminiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: fullPrompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        safetyFilterLevel: "block_only_high",
        personGeneration: "allow_adult",
      },
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`no image in response: ${JSON.stringify(data).slice(0, 200)}`);
  return b64;
}

const tilesToGenerate = onlySlug
  ? TILES.filter((t) => t.slug === onlySlug)
  : TILES;

if (onlySlug && tilesToGenerate.length === 0) {
  console.error(`error: no tile with slug "${onlySlug}". valid slugs:`);
  for (const t of TILES) console.error(`  ${t.slug}`);
  process.exit(1);
}

// ── main loop ────────────────────────────────────────────────
console.log(`generating ${tilesToGenerate.length} tile(s) via ${provider}${provider === "openai" ? ` (quality=${quality})` : ""}`);
console.log(`output dir: ${OUTPUT_DIR}\n`);

await mkdir(OUTPUT_DIR, { recursive: true });

let succeeded = 0;
let failed = 0;

for (const tile of tilesToGenerate) {
  const fullPrompt = `${STYLE_BASELINE}\n\nSubject: ${tile.visual}`;
  const outPath = join(OUTPUT_DIR, `${tile.slug}.png`);

  if (dryRun) {
    console.log(`[dry-run] ${tile.slug} → ${outPath}`);
    console.log(`  prompt: ${fullPrompt.slice(0, 200)}...\n`);
    continue;
  }

  process.stdout.write(`  ${tile.name.padEnd(16)} → `);

  try {
    const b64 = provider === "openai"
      ? await generateOpenAi(fullPrompt)
      : await generateImagen(fullPrompt);
    await writeFile(outPath, Buffer.from(b64, "base64"));
    console.log(`ok (${(Buffer.from(b64, "base64").length / 1024).toFixed(0)} KB)`);
    succeeded++;
  } catch (err) {
    console.log(`FAILED`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log(`\ndone: ${succeeded} succeeded, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
