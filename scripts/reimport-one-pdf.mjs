#!/usr/bin/env node
/**
 * One-off re-import of a single PCS PDF via the upgraded extractor.
 * Used after the Lauren-template migration archived the original records.
 *
 *   node scripts/reimport-one-pdf.mjs path/to/file.pdf
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Load env (same pattern as migrate-lauren-template.mjs)
for (const candidate of ['.env.local', '.env.local.migration']) {
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

const pdfPath = process.argv[2];
if (!pdfPath || !existsSync(pdfPath)) {
  console.error('Usage: node scripts/reimport-one-pdf.mjs <path-to-pdf>');
  process.exit(1);
}

const { extractFromPdf, commitExtraction } = await import('../src/lib/pcs-pdf-import.js');

console.log(`Reading ${pdfPath}…`);
const buf = readFileSync(pdfPath);
console.log(`Sending ${(buf.length / 1024).toFixed(0)} KB to Claude for extraction…`);

try {
  const data = await extractFromPdf(buf, pdfPath.split('/').pop());
  console.log('Extraction succeeded. Summary:');
  console.log(`  PCS ID: ${data.document?.pcsId || '—'}`);
  console.log(`  Finished Good: ${data.document?.finishedGoodName || '—'}`);
  console.log(`  Format: ${data.document?.fmt || '—'}`);
  console.log(`  SKUs: ${data.document?.skus?.length || 0}`);
  console.log(`  Version: ${data.version?.version || '—'}`);
  console.log(`  Product Name: ${data.version?.productName || '—'}`);
  // Wave 4.1a — demographic is now either an axes object or a legacy flat array.
  const demo = data.version?.demographic;
  if (demo && typeof demo === 'object' && !Array.isArray(demo)) {
    const total = ['biologicalSex', 'ageGroup', 'lifeStage', 'lifestyle']
      .reduce((sum, k) => sum + (Array.isArray(demo[k]) ? demo[k].length : 0), 0);
    console.log(`  Demographics: ${total} (axes: sex=${demo.biologicalSex?.length || 0}, age=${demo.ageGroup?.length || 0}, life=${demo.lifeStage?.length || 0}, lifestyle=${demo.lifestyle?.length || 0})`);
  } else {
    console.log(`  Demographics: ${demo?.length || 0} (legacy flat)`);
  }
  console.log(`  Formula Lines: ${data.formulaLines?.length || 0}`);
  console.log(`  Claims: ${data.claims?.length || 0}`);
  const doseReqs = (data.claims || []).reduce((sum, c) => sum + (c.doseRequirements?.length || 0), 0);
  console.log(`  Claim Dose Requirements: ${doseReqs}`);
  console.log(`  Evidence Packets: ${data.evidencePackets?.length || 0}`);
  console.log(`  References: ${data.references?.length || 0}`);
  console.log(`  Revision History: ${data.revisionHistory?.length || 0}`);

  console.log('\nCommitting to Notion…');
  const result = await commitExtraction(data, null);
  console.log('\nCommit succeeded:');
  console.log(`  Document ID: ${result.documentId}`);
  console.log(`  Version ID: ${result.versionId}`);
  console.log(`  Claims: ${result.claimIds.length}`);
  console.log(`  Formula Lines: ${result.formulaLineIds.length}`);
  console.log(`  References: ${result.referenceIds.length}`);
  console.log(`  Revision Events: ${result.revisionEventIds.length}`);
  console.log(`  Claim Dose Reqs: ${result.claimDoseReqIds.length}`);
  console.log(`  Evidence Packets: ${result.evidencePacketIds.length}`);
} catch (e) {
  console.error('\nFAILED:', e.message);
  process.exit(1);
}
