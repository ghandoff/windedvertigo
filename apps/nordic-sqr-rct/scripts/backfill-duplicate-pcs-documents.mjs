#!/usr/bin/env node
/**
 * 2026-05-04 — soft-merge duplicate PCS Documents.
 *
 * The PCS Documents Notion DB has 7 duplicate PCS-ID groups (16 dupe rows
 * total). This script picks a canonical row per group, then marks the
 * others by setting:
 *   - `Canonical document` relation → canonical row's page id
 *   - `Archived` checkbox → true
 *
 * Resolution rules per duplicate group:
 *   1. If exactly one row has `Template version = Lauren v1.0` and at least
 *      one other row has empty/Legacy/partial template version, KEEP the
 *      Lauren v1.0 row (template-migration pair).
 *   2. Otherwise (re-import noise), KEEP the row with the most-recent
 *      `last_edited_time`. Tie-break on `Latest Version` set non-null,
 *      then on `Template signals` populated, then on lowest page-id (stable).
 *
 * The script is dry-run by default. Run with --apply to write.
 */

import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const { getAllDocuments, updateDocument } = await import('../src/lib/pcs-documents.js');
const APPLY = process.argv.includes('--apply');

console.log(`\n${APPLY ? 'APPLY' : 'DRY-RUN'} — soft-merge duplicate PCS Documents\n`);

const docs = await getAllDocuments();
console.log(`Loaded ${docs.length} documents.`);

// Group by pcsId
const groups = new Map();
for (const d of docs) {
  if (!d.pcsId) continue;
  if (!groups.has(d.pcsId)) groups.set(d.pcsId, []);
  groups.get(d.pcsId).push(d);
}
const dupeGroups = [...groups.entries()].filter(([_, arr]) => arr.length > 1);
console.log(`${dupeGroups.length} duplicate groups (${dupeGroups.reduce((s, [_, a]) => s + a.length - 1, 0)} duplicate rows).`);

function pickCanonical(rows) {
  // Rule 1: template-migration pair
  const lauren = rows.filter((r) => r.templateVersion === 'Lauren v1.0');
  const nonLauren = rows.filter((r) => r.templateVersion !== 'Lauren v1.0');
  if (lauren.length === 1 && nonLauren.length >= 1) {
    return { canonical: lauren[0], reason: 'template-migration: kept Lauren v1.0 over non-template' };
  }
  // Rule 2: re-import noise — pick most-recent edit, tie-break on Latest Version + template signals
  const ranked = rows
    .filter((r) => !r.canonicalDocumentId) // skip already-marked dupes
    .sort((a, b) => {
      const editA = new Date(a.lastEditedTime).getTime();
      const editB = new Date(b.lastEditedTime).getTime();
      if (editA !== editB) return editB - editA;
      const lvA = a.latestVersionId ? 1 : 0;
      const lvB = b.latestVersionId ? 1 : 0;
      if (lvA !== lvB) return lvB - lvA;
      const tsA = a.templateSignals?.length || 0;
      const tsB = b.templateSignals?.length || 0;
      if (tsA !== tsB) return tsB - tsA;
      return a.id.localeCompare(b.id);
    });
  return { canonical: ranked[0], reason: 're-import noise: kept most-recent edit' };
}

let writes = 0;
let writesFailed = 0;
for (const [pcsId, rows] of dupeGroups) {
  // Skip if any row is already marked as canonical+dupe pair (idempotent)
  const alreadyResolved = rows.some((r) => r.canonicalDocumentId);
  if (alreadyResolved) {
    console.log(`\n${pcsId}: already partially resolved, skipping`);
    continue;
  }

  const { canonical, reason } = pickCanonical(rows);
  const dupes = rows.filter((r) => r.id !== canonical.id);
  console.log(`\n${pcsId} — ${reason}`);
  console.log(`  KEEP    ${canonical.id.slice(0, 8)} | tv=${canonical.templateVersion || '—'} | edit=${canonical.lastEditedTime?.slice(0, 16)}`);
  for (const d of dupes) {
    console.log(`  DUPE→   ${d.id.slice(0, 8)} | tv=${d.templateVersion || '—'} | edit=${d.lastEditedTime?.slice(0, 16)}`);
    if (APPLY) {
      try {
        await updateDocument(d.id, {
          canonicalDocumentId: canonical.id,
          archived: true,
        });
        writes++;
      } catch (err) {
        console.log(`  FAIL    ${d.id.slice(0, 8)}: ${err.message}`);
        writesFailed++;
      }
    }
  }
}

console.log(`\n${APPLY ? `Done. ${writes} duplicates marked, ${writesFailed} failed.` : 'Dry-run complete. Re-run with --apply to write.'}`);
