#!/usr/bin/env node
/**
 * One-off harness for manually validating the Wave 5.5 label copy drafter.
 *
 * Reads a Product Label row by id, follows its PCS relation → latest version
 * → 3A-approved claims, then prints the drafter output as JSON.
 *
 *   node scripts/test-label-copy-draft.mjs <labelId> [framework] [tone] [charBudget]
 *
 * Defaults: framework="FDA (US)", tone="consumer", charBudget="medium".
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Lightweight .env.local loader — same pattern as test-label-extraction.mjs.
const envCandidates = ['.env.local', '.env.local.migration'];
for (const candidate of envCandidates) {
  const envFile = resolve(projectRoot, candidate);
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    let val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    val = val.replace(/\\n$/, '').trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const [labelId, frameworkArg, toneArg, budgetArg] = process.argv.slice(2);
if (!labelId) {
  console.error('Usage: node scripts/test-label-copy-draft.mjs <labelId> [framework] [tone] [charBudget]');
  console.error('  framework: "FDA (US)" | "Health Canada" | "EU EFSA"   (default: "FDA (US)")');
  console.error('  tone:      clinical | consumer | athletic              (default: consumer)');
  console.error('  budget:    short | medium | long                       (default: medium)');
  process.exit(2);
}

const regulatoryFramework = frameworkArg || 'FDA (US)';
const tone = toneArg || 'consumer';
const charBudget = budgetArg || 'medium';

const { getLabel } = await import('../src/lib/pcs-labels.js');
const { getDocument } = await import('../src/lib/pcs-documents.js');
const { getVersion, getVersionsForDocument } = await import('../src/lib/pcs-versions.js');
const { getClaimsForVersion } = await import('../src/lib/pcs-claims.js');
const { draftLabelCopy, estimateCost } = await import('../src/lib/label-copy-drafter.js');

const label = await getLabel(labelId);
if (!label?.pcsDocumentId) {
  console.error('Label has no backing PCS document — cannot draft.');
  process.exit(1);
}
const doc = await getDocument(label.pcsDocumentId);
let version = null;
if (doc.latestVersionId) {
  try { version = await getVersion(doc.latestVersionId); } catch { version = null; }
}
if (!version) {
  const all = await getVersionsForDocument(doc.id).catch(() => []);
  version = all.find(v => v.isLatest) || all[0] || null;
}
if (!version) {
  console.error('Backing PCS has no version.');
  process.exit(1);
}
const allClaims = await getClaimsForVersion(version.id);
const claims3A = allClaims.filter(c => c.claimBucket === '3A' &&
  ((c.claimStatus || '').toLowerCase() === '' || (c.claimStatus || '').toLowerCase() === 'approved')
);

if (claims3A.length === 0) {
  console.error('No 3A-approved claims found on version', version.version);
  process.exit(1);
}

console.error(`Label: ${label.sku}  |  PCS: ${doc.pcsId} v${version.version}  |  3A claims: ${claims3A.length}`);
console.error(`Framework: ${regulatoryFramework}  |  Tone: ${tone}  |  Budget: ${charBudget}`);
console.error(`Est. cost: ${JSON.stringify(estimateCost(claims3A.length))}`);
console.error('Drafting…');

const result = await draftLabelCopy({
  pcsClaims: claims3A,
  regulatoryFramework,
  tone,
  charBudget,
});

console.log(JSON.stringify(result, null, 2));
