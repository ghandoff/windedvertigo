#!/usr/bin/env node
/**
 * Phase E of Lauren's-template migration:
 *   1. Identify pre-migration PCS Documents (those lacking the new
 *      Lauren-template fields: Finished Good Name, Format (FMT),
 *      SAP Material No.)
 *   2. Archive each of them (set `Archived = true` + rename PCS ID
 *      with an "[ARCHIVED]" prefix so the re-imported versions don't
 *      collide).
 *   3. Re-import any PCS PDFs we can find locally on disk via the
 *      upgraded extractor.
 *
 * Run:
 *   node scripts/migrate-lauren-template.mjs              # Dry-run, shows plan
 *   node scripts/migrate-lauren-template.mjs --archive    # Archive only
 *   node scripts/migrate-lauren-template.mjs --archive --reimport  # Archive + re-import
 *
 * Relies on .env.local.migration (pulled from Vercel) for NOTION_TOKEN
 * and NOTION_PCS_* IDs + LLM_API_KEY.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Note: `notion` is imported dynamically below, *after* the env-loader has
// populated process.env — the shared module reads NOTION_TOKEN at import
// time, so static `import` at the top of this file would see an undefined
// token and fail.

// ─── Load env ─────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
// Prefer .env.local (has all PCS DB IDs). Fall back to .env.local.migration
// (which only has development env vars) if .env.local is missing.
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
    // Strip trailing literal \n that Vercel sometimes adds when values were
    // piped with a trailing newline.
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

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DOCS_DB = process.env.NOTION_PCS_DOCUMENTS_DB;
if (!NOTION_TOKEN || !DOCS_DB) {
  console.error('Missing NOTION_TOKEN or NOTION_PCS_DOCUMENTS_DB');
  process.exit(1);
}

// ─── Args ─────────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const ARCHIVE = args.has('--archive');
const REIMPORT = args.has('--reimport');

// ─── Notion client ────────────────────────────────────────────────────────
// Dynamic import so the shared module sees the env vars we just loaded.
const { notion } = await import('../src/lib/notion.js');

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}
function extractRichText(prop) {
  return (prop?.rich_text || []).map(t => t.plain_text).join('');
}

async function listAllDocuments() {
  const all = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: DOCS_DB,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

function isPreMigration(doc) {
  const p = doc.properties;
  // If the Finished Good Name rich_text is empty AND Format (FMT)
  // select is null AND SAP Material No. is empty → pre-migration.
  const finishedGoodName = extractRichText(p['Finished Good Name']);
  const format = p['Format (FMT)']?.select?.name || null;
  const sap = extractRichText(p['SAP Material No.']);
  const alreadyArchived = p['Archived']?.checkbox || false;
  return !alreadyArchived && !finishedGoodName && !format && !sap;
}

async function archiveDocument(doc) {
  const p = doc.properties;
  const pcsId = extractTitle(p['PCS ID']);
  const newTitle = pcsId.startsWith('[ARCHIVED]') ? pcsId : `[ARCHIVED] ${pcsId}`;
  await notion.pages.update({
    page_id: doc.id,
    properties: {
      'PCS ID': { title: [{ text: { content: newTitle } }] },
      'Archived': { checkbox: true },
    },
  });
  return { id: doc.id, originalTitle: pcsId, newTitle };
}

// ─── PDF re-import ────────────────────────────────────────────────────────
const PDF_SEARCH_ROOTS = [
  '/Users/garrettjaeger/Library/CloudStorage/GoogleDrive-garrett@windedvertigo.com/Shared drives/winded.vertigo/clients/nordic naturals/docs/PCS Documents/PDFs',
  '/Users/garrettjaeger/Library/CloudStorage/GoogleDrive-garrett@windedvertigo.com/Shared drives/winded.vertigo/clients/nordic naturals/docs/PCS Documents',
];

function findPdfForPcsId(pcsId) {
  // pcsId might be "PCS-0036" or "[ARCHIVED] PCS-0036" — strip prefix
  const clean = pcsId.replace(/^\[ARCHIVED\]\s*/, '').trim();
  for (const root of PDF_SEARCH_ROOTS) {
    if (!existsSync(root)) continue;
    try {
      const files = readdirSync(root);
      const match = files.find(f => f.startsWith(clean) && f.endsWith('.pdf'));
      if (match) return resolve(root, match);
    } catch { /* skip inaccessible dirs */ }
  }
  return null;
}

// Lazy import because it pulls @anthropic-ai/sdk
async function reimportPdf(pdfPath, pcsId) {
  const { extractFromPdf, commitExtraction } = await import('../src/lib/pcs-pdf-import.js');
  const buf = readFileSync(pdfPath);
  console.log(`    Extracting ${pdfPath.split('/').pop()}…`);
  const data = await extractFromPdf(buf, pdfPath.split('/').pop());
  // Force the document PCS ID to match (in case extractor emits a slightly different label)
  if (!data.document) data.document = {};
  if (!data.document.pcsId) data.document.pcsId = pcsId.replace(/^\[ARCHIVED\]\s*/, '').trim();
  console.log(`    Committing extraction…`);
  const result = await commitExtraction(data, null); // null = create new, don't update archived
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('Querying PCS Documents…');
  const all = await listAllDocuments();
  console.log(`Found ${all.length} total PCS Documents\n`);

  const pre = all.filter(isPreMigration);
  console.log(`Pre-migration (candidates for archive): ${pre.length}`);
  for (const doc of pre) {
    const pcsId = extractTitle(doc.properties['PCS ID']);
    const pdfPath = findPdfForPcsId(pcsId);
    console.log(`  • ${pcsId}  — PDF ${pdfPath ? '✓ found locally' : '✗ not on disk'}`);
  }

  if (pre.length === 0) {
    console.log('\nNothing to migrate. Exiting.');
    return;
  }

  if (!ARCHIVE) {
    console.log('\nDry run. Pass --archive to archive these, or --archive --reimport to archive + re-import.');
    return;
  }

  console.log('\nArchiving…');
  for (const doc of pre) {
    const r = await archiveDocument(doc);
    console.log(`  ✓ ${r.originalTitle} → ${r.newTitle}`);
  }

  if (!REIMPORT) {
    console.log('\nArchive complete. Pass --reimport to re-extract PDFs locally available.');
    return;
  }

  console.log('\nRe-importing PDFs that are locally available…');
  for (const doc of pre) {
    const originalId = extractTitle(doc.properties['PCS ID']).replace(/^\[ARCHIVED\]\s*/, '');
    const pdfPath = findPdfForPcsId(originalId);
    if (!pdfPath) {
      console.log(`  ⚠ ${originalId} — no local PDF; upload manually via /pcs/import`);
      continue;
    }
    try {
      const result = await reimportPdf(pdfPath, originalId);
      console.log(`  ✓ ${originalId} → document ${result.documentId}, version ${result.versionId},`
        + ` claims=${result.claimIds.length}, formulaLines=${result.formulaLineIds.length},`
        + ` evidencePackets=${result.evidencePacketIds.length}, doseReqs=${result.claimDoseReqIds.length}`);
    } catch (e) {
      console.log(`  ✗ ${originalId} — ${e.message}`);
    }
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
