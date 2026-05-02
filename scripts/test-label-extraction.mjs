#!/usr/bin/env node
/**
 * One-off harness for manually validating Claude Vision label extraction
 * (Wave 5.1 — added 2026-04-21).
 *
 * Point it at a local image file and it prints the structured extraction
 * JSON + the confidence-gate evaluation. Useful for Lauren/Gina to eyeball
 * extractions before we let the intake script touch the live Notion DB.
 *
 *   node scripts/test-label-extraction.mjs path/to/label.jpg
 *
 * Wave 5.1.2 — mixed image + PDF inputs are supported:
 *   node scripts/test-label-extraction.mjs front.pdf back.png
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Lightweight .env.local loader (same pattern as ingest-label-intake.mjs).
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

const imagePaths = process.argv.slice(2);
if (imagePaths.length === 0) {
  console.error('Usage: node scripts/test-label-extraction.mjs <front.jpg|pdf> [back.jpg|pdf] [side.jpg|pdf] ...');
  console.error('       Wave 5.1.1 — pass multiple paths to test multi-panel extraction.');
  console.error('       Wave 5.1.2 — PDF and image inputs may be mixed in the same call.');
  process.exit(2);
}
const absolutePaths = imagePaths.map(p => {
  const abs = resolve(process.cwd(), p);
  if (!existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(2);
  }
  return abs;
});
if (!process.env.LLM_API_KEY) {
  console.error('LLM_API_KEY is not set — add it to .env.local or the shell environment.');
  process.exit(1);
}

const { extractLabel, evaluateConfidenceGates, LABEL_EXTRACTION_PROMPT_VERSION } =
  await import('../src/lib/label-extraction.js');

function mediaTypeFor(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return undefined; // let extractLabel's own inferMediaType decide
}

const images = absolutePaths.map(abs => {
  const buf = readFileSync(abs);
  const filename = basename(abs);
  return {
    buffer: buf,
    filename,
    mediaType: mediaTypeFor(filename),
    _size: buf.length,
    _path: abs,
  };
});

console.log(`\n=== Label extraction smoke test ===`);
console.log(`Panels: ${images.length}`);
for (let i = 0; i < images.length; i++) {
  console.log(`  [${i + 1}/${images.length}] ${images[i]._path} (${(images[i]._size / 1024).toFixed(1)} KB)`);
}
console.log(`Prompt version: ${LABEL_EXTRACTION_PROMPT_VERSION}`);
console.log(`Model: ${process.env.LABEL_EXTRACTION_MODEL || 'claude-sonnet-4-5'}\n`);

const started = Date.now();
const extraction = await extractLabel(
  images.map(i => ({ buffer: i.buffer, filename: i.filename, mediaType: i.mediaType })),
);
const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const gate = evaluateConfidenceGates(extraction);

console.log(JSON.stringify(extraction, null, 2));
console.log(`\n--- Gate ---`);
console.log(`passes: ${gate.passes}`);
if (!gate.passes) {
  console.log(`reasons:`);
  for (const r of gate.reasons) console.log(`  - ${r}`);
  if (gate.lowDoseIngredients.length) {
    console.log(`low-confidence active-ingredient doses: ${gate.lowDoseIngredients.join(', ')}`);
  }
}
console.log(`\nelapsed: ${elapsed}s`);
