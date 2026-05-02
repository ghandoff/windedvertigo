#!/usr/bin/env node
/**
 * Wave 5.2 — manual drift-detection dry-run for a single label.
 *
 * Usage:
 *   node scripts/test-label-drift.mjs <labelId>
 *
 * Prints the findings array + stats without suppressing errors, so operators
 * can sanity-check claim-similarity scoring and ingredient/dose matching on
 * a real label before trusting the nightly sweep.
 *
 * Requires the usual PCS env: NOTION_TOKEN, NOTION_PCS_*_DB ids, LLM_API_KEY.
 */

import { detectDriftForLabel } from '../src/lib/label-drift.js';

const labelId = process.argv[2];
if (!labelId) {
  console.error('Usage: node scripts/test-label-drift.mjs <labelId>');
  process.exit(1);
}

const started = Date.now();
const result = await detectDriftForLabel(labelId);
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

console.log('\n=== Label Drift Dry-Run ===');
console.log(`Label: ${result.labelId}`);
console.log(`Elapsed: ${elapsed}s`);
if (result.error) {
  console.log(`Error: ${result.error}`);
}
console.log(`Findings (${result.findings.length}):`);
for (const f of result.findings) {
  console.log(`  - [${f.type}] ${f.note}`);
}
console.log('Stats:', result.stats);
