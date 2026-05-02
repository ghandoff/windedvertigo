#!/usr/bin/env node
/**
 * Backfill demographic axes on existing PCS Versions (Wave 4.1a).
 *
 * The legacy `Demographic` property on PCS Versions was a flat multi-select
 * that collapsed four orthogonal axes into one list. Wave 4.1a introduces
 * separate multi-selects for Biological Sex, Age Group, Life Stage, and
 * Lifestyle. This script routes each legacy value into one of those axes
 * via keyword matching. Values we can't confidently route are written to
 * `Demographic backfill review` (rich_text) for manual triage.
 *
 * The legacy `Demographic` property is NOT cleared by this script — that
 * happens in Wave 4.1b after the backfill is verified.
 *
 * Run:
 *   node scripts/backfill-demographic-axes.mjs --dry-run
 *   node scripts/backfill-demographic-axes.mjs --limit=5 --dry-run
 *   node scripts/backfill-demographic-axes.mjs              # LIVE
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

// ─── Classifier ─────────────────────────────────────────────────────────────
/**
 * Route a single legacy demographic value into one of the four axes.
 * Returns { axis: 'biologicalSex'|'ageGroup'|'lifeStage'|'lifestyle'|null, value }.
 *
 * Heuristic keyword matching — conservative. When in doubt, returns null
 * so the caller can flag the value for manual review.
 */
export function routeDemographicValue(raw) {
  const v = String(raw || '').trim();
  const lower = v.toLowerCase();
  if (!v) return { axis: null, value: v };

  // Biological Sex
  if (/^(male|female|any sex|both sexes|men|women)$/i.test(v)) {
    return { axis: 'biologicalSex', value: v };
  }

  // Life Stage — prenatal/lactating/infant are clearly life-stage.
  if (/(prenatal|pregnan|lactat|postpartum|menopaus|perimenopaus)/i.test(lower)) {
    return { axis: 'lifeStage', value: v };
  }

  // Age Group — anything with age numbers (digits + y|yo|mo) or common age bands.
  if (/\b\d+\s*[-–]\s*\d+\s*(y|yo|yr|yrs|mo|month)/i.test(lower)
      || /\b(≥|>=|<=|≤)\s*\d+\s*(y|yo|yr)/i.test(lower)
      || /\b\d+\s*\+\s*(y|yo|yr)/i.test(lower)
      || /^(infants?|children|adolescents?|teens?|adults?|seniors?|elderly|all ages)\b/i.test(lower)
      || /^(pediatric|geriatric)\b/i.test(lower)) {
    return { axis: 'ageGroup', value: v };
  }

  // Lifestyle
  if (/(athlete|vegan|vegetarian|pescatarian|keto|paleo|pet parent|active|endurance)/i.test(lower)) {
    return { axis: 'lifestyle', value: v };
  }

  return { axis: null, value: v };
}

/**
 * Apply routing to a flat legacy demographic array.
 * Returns { axes: {...}, unrouted: [...] }.
 */
export function routeDemographicList(flatList) {
  const axes = { biologicalSex: [], ageGroup: [], lifeStage: [], lifestyle: [] };
  const unrouted = [];
  for (const v of flatList || []) {
    const { axis, value } = routeDemographicValue(v);
    if (axis && axes[axis]) {
      if (!axes[axis].includes(value)) axes[axis].push(value);
    } else {
      unrouted.push(value);
    }
  }
  return { axes, unrouted };
}

// ─── Load libs (dynamic so env is populated first) ──────────────────────────
const { getAllVersions, updateVersion } = await import('../src/lib/pcs-versions.js');

console.log(`\n=== Demographic-axes backfill (Wave 4.1a) ===`);
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (LIMIT) console.log(`Limit: ${LIMIT} versions`);
console.log('');

const versions = await getAllVersions();
console.log(`Fetched ${versions.length} PCS Versions`);
const target = LIMIT ? versions.slice(0, LIMIT) : versions;

const stats = {
  processed: 0,
  skippedNoLegacy: 0,
  skippedAlreadyPopulated: 0,
  routed: 0,
  unroutedFlagged: 0,
};
const errors = [];

for (const v of target) {
  try {
    const legacy = Array.isArray(v.demographic) ? v.demographic : [];
    const alreadyPopulated =
      (v.biologicalSex?.length || 0) +
      (v.ageGroup?.length || 0) +
      (v.lifeStage?.length || 0) +
      (v.lifestyle?.length || 0) > 0;

    if (legacy.length === 0) {
      stats.skippedNoLegacy++;
      continue;
    }
    if (alreadyPopulated) {
      stats.skippedAlreadyPopulated++;
      console.log(`[skip] ${v.version || v.id}: axes already populated`);
      continue;
    }

    const { axes, unrouted } = routeDemographicList(legacy);
    const totalRouted = axes.biologicalSex.length + axes.ageGroup.length
                      + axes.lifeStage.length + axes.lifestyle.length;

    const reviewNote = unrouted.length
      ? `Wave 4.1a unrouted: ${unrouted.join('; ')}`
      : '';

    const tag = dryRun ? '[dry]' : '[ok]';
    console.log(
      `${tag} ${v.version || v.id}: ` +
      `sex=${axes.biologicalSex.length} age=${axes.ageGroup.length} ` +
      `life=${axes.lifeStage.length} lifestyle=${axes.lifestyle.length} ` +
      (unrouted.length ? `unrouted=${unrouted.length} (${unrouted.join(', ')})` : 'unrouted=0')
    );

    if (!dryRun) {
      const updatePayload = {
        biologicalSex: axes.biologicalSex,
        ageGroup: axes.ageGroup,
        lifeStage: axes.lifeStage,
        lifestyle: axes.lifestyle,
      };
      if (reviewNote) updatePayload.demographicBackfillReview = reviewNote;
      await updateVersion(v.id, updatePayload);
    }

    stats.processed++;
    stats.routed += totalRouted;
    if (unrouted.length) stats.unroutedFlagged++;
  } catch (err) {
    console.error(`[fail] ${v.version || v.id}: ${err?.message || err}`);
    errors.push({ id: v.id, version: v.version, error: err?.message || String(err) });
  }
}

console.log('\n=== Summary ===');
console.log(JSON.stringify({
  dryRun,
  total: target.length,
  ...stats,
  errorCount: errors.length,
}, null, 2));

if (errors.length > 0) {
  console.log('\n=== Errors ===');
  for (const e of errors) console.log(`  ${e.version || e.id}: ${e.error}`);
  process.exit(1);
}
