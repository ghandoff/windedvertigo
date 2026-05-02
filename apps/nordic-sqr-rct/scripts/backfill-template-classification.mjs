#!/usr/bin/env node
/**
 * Backfill Template-version classification on existing PCS Documents.
 *
 * Wave 3.7 — added 2026-04-21.
 *
 * Run:
 *   node scripts/backfill-template-classification.mjs              # live, all docs
 *   node scripts/backfill-template-classification.mjs --dry-run    # preview only
 *   node scripts/backfill-template-classification.mjs --limit=5    # cap batch size
 *   node scripts/backfill-template-classification.mjs --dry-run --limit=12
 *
 * Env: reads .env.local (NOTION_TOKEN, NOTION_PCS_*).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env (same pattern as scripts/backfill-claim-prefixes.mjs) ─────────
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

// ─── Load libs (dynamic so env is populated first) ──────────────────────────
const { getAllDocuments, updateDocument } = await import('../src/lib/pcs-documents.js');
const { getVersionsForDocument, getVersion } = await import('../src/lib/pcs-versions.js');
const { getClaimsForVersion } = await import('../src/lib/pcs-claims.js');
const { getFormulaLinesForVersion } = await import('../src/lib/pcs-formula-lines.js');
const { getEventsForVersion } = await import('../src/lib/pcs-revision-events.js');
const { getPacketsForClaim } = await import('../src/lib/pcs-evidence-packets.js');
const { classifyTemplate } = await import('../src/lib/pcs-template-classifier.js');

console.log(`\n=== Template-version backfill ===`);
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (LIMIT) console.log(`Limit: ${LIMIT} documents`);
console.log('');

const docs = await getAllDocuments();
console.log(`Fetched ${docs.length} PCS Documents`);
const target = LIMIT ? docs.slice(0, LIMIT) : docs;

const counts = {};
const errors = [];
for (const doc of target) {
  try {
    const versions = await getVersionsForDocument(doc.id);
    const latest = versions.find(v => v.isLatest)
      || versions.sort((a, b) => (b.lastEditedTime || '').localeCompare(a.lastEditedTime || ''))[0];
    if (!latest) {
      errors.push({ pcsId: doc.pcsId, error: 'no version' });
      console.warn(`[skip] ${doc.pcsId}: no version`);
      continue;
    }
    const version = await getVersion(latest.id);
    const [claims, formulaLines, revisionHistory] = await Promise.all([
      getClaimsForVersion(latest.id),
      getFormulaLinesForVersion(latest.id),
      getEventsForVersion(latest.id),
    ]);
    // Packets are claim-scoped — fan out from claims
    const packetArrays = await Promise.all(claims.map(c => getPacketsForClaim(c.id)));
    const evidencePackets = packetArrays.flat();
    const extraction = {
      document: {
        finishedGoodName: doc.finishedGoodName,
        fmt: doc.format,
        sapMaterialNo: doc.sapMaterialNo,
        skus: doc.skus || [],
      },
      version: {
        productName: version.productName,
        demographic: version.demographic || [],
        // Demographic axes (Wave 4.1a) — classifier now counts populated axes
        biologicalSex: version.biologicalSex || [],
        ageGroup:      version.ageGroup      || [],
        lifeStage:     version.lifeStage     || [],
        lifestyle:     version.lifestyle     || [],
      },
      formulaLines,
      claims,
      revisionHistory,
      evidencePackets,
    };
    const c = classifyTemplate(extraction);
    counts[c.templateVersion] = (counts[c.templateVersion] || 0) + 1;
    const tag = dryRun ? '[dry]' : '[ok]';
    console.log(`${tag} ${doc.pcsId}: ${c.templateVersion} (${c.positiveCount}+ / ${c.negativeCount}-)`);
    // Always show per-signal breakdown so this doubles as a diagnostic
    for (const s of c.signals.positive) console.log(`       + ${s}`);
    for (const s of c.signals.negative) console.log(`       − ${s}`);
    if (!dryRun) {
      const signalsText = [
        `Positive (${c.signals.positive.length}): ${c.signals.positive.join('; ') || 'none'}`,
        `Negative (${c.signals.negative.length}): ${c.signals.negative.join('; ') || 'none'}`,
      ].join('\n');
      await updateDocument(doc.id, {
        templateVersion: c.templateVersion,
        templateSignals: signalsText,
      });
    }
  } catch (err) {
    console.error(`[fail] ${doc.pcsId}: ${err?.message || err}`);
    errors.push({ pcsId: doc.pcsId, error: err?.message || String(err) });
  }
}

console.log('\n=== Summary ===');
console.log(JSON.stringify({
  dryRun,
  processed: target.length - errors.length,
  total: target.length,
  counts,
  errorCount: errors.length,
}, null, 2));

if (errors.length > 0) {
  console.log('\n=== Errors ===');
  for (const e of errors) console.log(`  ${e.pcsId}: ${e.error}`);
  process.exit(1);
}
