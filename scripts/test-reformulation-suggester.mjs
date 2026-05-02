#!/usr/bin/env node
/**
 * One-off harness for manually validating the Wave 5.6 reformulation suggester.
 *
 * Reads a Product Label row by id, follows its PCS relation → latest version
 * → 3A-approved claims, then runs the suggester against a flagged ingredient
 * and prints JSON to stdout.
 *
 *   node scripts/test-reformulation-suggester.mjs <labelId> <ingredientName> [dose] [doseUnit] [demographic] [evidenceId]
 *
 * Examples:
 *   node scripts/test-reformulation-suggester.mjs L-123 "magnesium oxide" 160 mg pediatric
 *   node scripts/test-reformulation-suggester.mjs L-123 "vitamin B6" 50 mg adult E-evidence-id-here
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Lightweight .env.local loader — matches test-label-copy-draft.mjs.
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

const [labelId, ingredientName, doseArg, doseUnitArg, demographicArg, evidenceIdArg] = process.argv.slice(2);
if (!labelId || !ingredientName) {
  console.error('Usage: node scripts/test-reformulation-suggester.mjs <labelId> <ingredientName> [dose] [doseUnit] [demographic] [evidenceId]');
  process.exit(2);
}

const currentDose = doseArg !== undefined ? Number(doseArg) : undefined;
const currentDoseUnit = doseUnitArg || 'mg';
const demographic = demographicArg || undefined;
const safetyEvidenceId = evidenceIdArg || undefined;

const { getLabel } = await import('../src/lib/pcs-labels.js');
const { getDocument } = await import('../src/lib/pcs-documents.js');
const { getVersion, getVersionsForDocument } = await import('../src/lib/pcs-versions.js');
const { getClaimsForVersion } = await import('../src/lib/pcs-claims.js');
const { getEvidence } = await import('../src/lib/pcs-evidence.js');
const { suggestReformulations, estimateCost } = await import('../src/lib/reformulation-suggester.js');

const label = await getLabel(labelId);
if (!label?.pcsDocumentId) {
  console.error('Label has no backing PCS document — cannot run suggester.');
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

let safetyEvidence = null;
if (safetyEvidenceId) {
  try { safetyEvidence = await getEvidence(safetyEvidenceId); } catch { safetyEvidence = null; }
}

console.error(`Label: ${label.sku}  |  PCS: ${doc.pcsId} v${version.version}  |  3A claims: ${claims3A.length}`);
console.error(`Flagged: ${ingredientName} @ ${currentDose ?? '?'}${currentDoseUnit}  |  Demographic: ${demographic || 'n/a'}`);
console.error(`Evidence: ${safetyEvidence ? safetyEvidence.id : '(none provided)'}`);
console.error(`Est. cost: ${JSON.stringify(estimateCost(claims3A.length))}`);
console.error('Suggesting…');

const result = await suggestReformulations({
  label,
  pcs: { id: doc.id, pcsId: doc.pcsId, versionId: version.id, version: version.version },
  claims: claims3A,
  flaggedIngredient: ingredientName,
  currentDose,
  currentDoseUnit,
  demographic,
  safetyEvidence,
});

console.log(JSON.stringify(result, null, 2));
