#!/usr/bin/env node
/**
 * Backfill Source Type + Vegan Compatible on Active Ingredient Forms (Wave 7.0.5 T6).
 *
 * Gina's review of Lauren's Wave 7.0.5 notes: Nordic actively sells
 * algae-based and lanolin-based options for vegans, so `source` is a
 * first-class filter for a meaningful chunk of the product line — not
 * the tier-2 "doesn't usually matter" attribute the draft framed it as.
 *
 * This script applies conservative keyword inference against each AI
 * Form's `Form name` + `Synonyms` to populate:
 *   - Source type (select)
 *   - Vegan compatible (checkbox)
 *
 * Ambiguous rows are SKIPPED — operators fill those in. Decisions are
 * logged either way.
 *
 * Run:
 *   node scripts/backfill-ai-form-sources.mjs --dry-run
 *   node scripts/backfill-ai-form-sources.mjs --limit=5 --dry-run
 *   node scripts/backfill-ai-form-sources.mjs              # LIVE
 *
 * Env: reads .env.local (NOTION_TOKEN, NOTION_PCS_*).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env ───────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const envCandidates = ['.env.local', '.env.local.migration'];
let envLoaded = 0;
for (const candidate of envCandidates) {
  const envFile = resolve(projectRoot, candidate);
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    let val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    val = val.replace(/\\n$/, '').trim();
    if (!process.env[key]) {
      process.env[key] = val;
      envLoaded++;
    }
  }
}
if (envLoaded === 0) {
  console.error('No env files found. Tried:', envCandidates.join(', '));
  process.exit(1);
}
if (!process.env.NOTION_TOKEN) {
  console.error('Missing required env: NOTION_TOKEN');
  process.exit(1);
}

// ─── Parse args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

// ─── Inference rules ────────────────────────────────────────────────────────
/**
 * Given an AI Form row, infer { sourceType, veganCompatible }.
 * Returns `null` fields when we can't decide confidently — operator fills in.
 *
 * Rules (applied in priority order, first match wins):
 *  1. "fish", "krill", "cod", "anchovy", "sardine", "salmon", "tuna" → marine-animal, NOT vegan
 *  2. "algae", "algal", "schizochytrium" → algae, vegan
 *  3. "lanolin" → lanolin, NOT vegan
 *  4. Plant-derived extracts w/ explicit botanical name ("turmeric", "curcumin",
 *     "ginger", "rosemary", "olive leaf", "green tea", "grape seed", "bilberry",
 *     "cellulose") → plant-extract, vegan
 *  5. Microbial / fermentation cues ("strain", "lactobacillus", "bifidobacterium",
 *     "saccharomyces", "fermented") → fermentation, vegan
 *  6. Mineral-form cues ("oxide", "carbonate", "sulfate", "chloride",
 *     "bisglycinate", "glycinate", "citrate", "malate") → mineral, vegan
 *     (Note: these are typically synthesized from mineral salts; leaving vegan
 *     compatible TRUE since the source material is non-animal.)
 *  7. "synthetic" in name/synonyms → synthetic, vegan
 *  8. Gelatin (capsule shell context) → animal, NOT vegan
 *  9. Otherwise → skip (return nulls)
 */
function infer(form) {
  const name = (form.formName || '').toLowerCase();
  const syns = (form.synonyms || '').toLowerCase();
  const hay = `${name} ${syns}`;

  // 1. Marine-animal
  if (/\b(fish|krill|cod|anchov|sardine|salmon|tuna|menhaden)\b/.test(hay)) {
    return { sourceType: 'marine-animal', veganCompatible: false, rule: 'marine-keyword' };
  }

  // 2. Algae (vegan-preferred omega source)
  if (/\b(algae|algal|schizochytrium|chlorella|spirulina)\b/.test(hay)) {
    return { sourceType: 'algae', veganCompatible: true, rule: 'algae-keyword' };
  }

  // 3. Lanolin (vitamin D3 source — NOT vegan, but portfolio offers alt)
  if (/\blanolin\b/.test(hay)) {
    return { sourceType: 'lanolin', veganCompatible: false, rule: 'lanolin-keyword' };
  }

  // 4. Gelatin — animal-derived capsule/shell material
  if (/\bgelatin\b/.test(hay) && !/\bvegetarian\b/.test(hay)) {
    return { sourceType: 'animal', veganCompatible: false, rule: 'gelatin-keyword' };
  }

  // 5. Plant extracts
  if (/\b(turmeric|curcumin|ginger|rosemary|olive leaf|green tea|grape seed|bilberry|cellulose|ashwagandha|bacopa|milk thistle|boswellia|echinacea)\b/.test(hay)) {
    return { sourceType: 'plant-extract', veganCompatible: true, rule: 'plant-extract-keyword' };
  }

  // 6. Fermentation / microbial
  if (/\b(lactobacillus|bifidobacterium|saccharomyces|streptococcus|fermented|fermentation)\b/.test(hay) || /\bstrain\b/.test(hay)) {
    return { sourceType: 'fermentation', veganCompatible: true, rule: 'fermentation-keyword' };
  }

  // 7. Mineral salts / chelates
  if (/\b(oxide|carbonate|sulfate|chloride|bisglycinate|glycinate|citrate|malate|gluconate|picolinate|orotate)\b/.test(hay)) {
    return { sourceType: 'mineral', veganCompatible: true, rule: 'mineral-salt-keyword' };
  }

  // 8. Explicit synthetic
  if (/\bsynthetic\b/.test(hay)) {
    return { sourceType: 'synthetic', veganCompatible: true, rule: 'synthetic-keyword' };
  }

  return { sourceType: null, veganCompatible: null, rule: 'skip' };
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const { getAllIngredientForms, updateIngredientForm } = await import(
    '../src/lib/pcs-ingredient-forms.js'
  );

  console.log(`[backfill-ai-form-sources] mode=${dryRun ? 'DRY-RUN' : 'LIVE'}${LIMIT ? ` limit=${LIMIT}` : ''}`);

  const all = await getAllIngredientForms();
  const rows = LIMIT ? all.slice(0, LIMIT) : all;

  console.log(`[backfill-ai-form-sources] fetched ${all.length} forms; processing ${rows.length}`);

  const stats = {
    total: rows.length,
    applied: 0,
    skipped: 0,
    alreadySet: 0,
    errors: 0,
    byRule: {},
  };

  for (const form of rows) {
    if (form.sourceType) {
      stats.alreadySet++;
      console.log(`  [already-set] "${form.formName}" sourceType=${form.sourceType}`);
      continue;
    }

    const { sourceType, veganCompatible, rule } = infer(form);
    stats.byRule[rule] = (stats.byRule[rule] || 0) + 1;

    if (!sourceType) {
      stats.skipped++;
      console.log(`  [skip] "${form.formName}" — no confident inference`);
      continue;
    }

    console.log(`  [apply] "${form.formName}" → sourceType=${sourceType} vegan=${veganCompatible} (rule=${rule})`);
    if (dryRun) {
      stats.applied++;
      continue;
    }

    try {
      await updateIngredientForm(form.id, { sourceType, veganCompatible });
      stats.applied++;
    } catch (err) {
      stats.errors++;
      console.error(`    ERROR updating ${form.id}: ${err.message}`);
    }
  }

  console.log('\n[backfill-ai-form-sources] summary:');
  console.log(`  total processed:  ${stats.total}`);
  console.log(`  already set:      ${stats.alreadySet}`);
  console.log(`  applied:          ${stats.applied}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`  skipped:          ${stats.skipped}`);
  console.log(`  errors:           ${stats.errors}`);
  console.log('  by rule:');
  for (const [rule, n] of Object.entries(stats.byRule)) {
    console.log(`    ${rule}: ${n}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
