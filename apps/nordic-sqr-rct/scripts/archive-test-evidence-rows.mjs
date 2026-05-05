#!/usr/bin/env node
/**
 * One-shot dedup cleanup — 2026-05-05.
 *
 * Archives Evidence Library rows that were created during today's
 * verification testing and are exact-DOI duplicates of legitimate
 * rows. "Archive" here means Notion's `archived: true` (soft delete,
 * 30-day trash retention; reversible by un-archiving the page in
 * Notion UI or via API).
 *
 * Decisions made by the agent + approved by the user (Option B):
 *   - Group only by exact DOI string. No fuzzy title matching.
 *   - Verified each candidate via notion-fetch to confirm:
 *     • blank page content
 *     • empty Citation, EndNote Group, EndNote Record ID, SQR review URL
 *     • no relations to PCS Documents, Claims, or Evidence Packets
 *       (relation properties absent from fetch output → empty)
 *
 * Targets:
 *   1. 357e4ee7-4ba4-8134-a485-d0e76d26d720 — "TEST-DELETE — Khalid et al. 2024 happy-path waterfall verification"
 *      Reason: explicit TEST-DELETE prefix; exact DOI duplicate of
 *      legitimate Khalid 2024 row 31ae4ee7-4ba4-8171-...
 *
 *   2. 357e4ee7-4ba4-81e2-8813-fceee87be9e5 — Knapen 2013 Three-year low-dose menaquinone-7 (third dup)
 *      Reason: exact DOI duplicate of 357e4ee7-4ba4-817c-... (kept).
 *
 *   3. 357e4ee7-4ba4-8168-8d36-ec786bf9d95e — Knapen 2013 Three-year low-dose menaquinone-7 (less-complete dup)
 *      Reason: exact DOI duplicate of 357e4ee7-4ba4-817c-... (kept).
 *      Has empty `userDefined:URL` field; the kept row has the PubMed URL set.
 *
 * Kept (NOT archived):
 *   - 31ae4ee7-4ba4-8171-8a9d-fe681f782e07 — legitimate Khalid 2024
 *   - 357e4ee7-4ba4-817c-8393-e11136ec8d8e — Knapen 2013 (most complete of the trio)
 *   - 357e4ee7-4ba4-810b-ba8a-dbcdc58f4002 — Knapen 2015 (no duplicates)
 *   - All other 84 rows
 *
 * Run with: node scripts/archive-test-evidence-rows.mjs
 *   (NOTION_TOKEN must be in env / .env.local)
 */

import 'dotenv/config';
import { Client } from '@notionhq/client';

const TARGETS = [
  {
    id: '357e4ee7-4ba4-8134-a485-d0e76d26d720',
    label: 'TEST-DELETE — Khalid et al. 2024',
  },
  {
    id: '357e4ee7-4ba4-81e2-8813-fceee87be9e5',
    label: 'Knapen 2013 dup #2 (newest of the trio)',
  },
  {
    id: '357e4ee7-4ba4-8168-8d36-ec786bf9d95e',
    label: 'Knapen 2013 dup #1 (least-complete)',
  },
];

const notion = new Client({ auth: process.env.NOTION_TOKEN, timeoutMs: 30000 });

if (!process.env.NOTION_TOKEN) {
  console.error('ERROR: NOTION_TOKEN not set in environment');
  process.exit(1);
}

console.log(`Archiving ${TARGETS.length} duplicate Evidence Library rows...`);
const results = [];
for (const t of TARGETS) {
  try {
    const before = await notion.pages.retrieve({ page_id: t.id });
    if (before.archived) {
      console.log(`  - ${t.label} [${t.id}] already archived, skipping.`);
      results.push({ id: t.id, status: 'already_archived' });
      continue;
    }
    await notion.pages.update({ page_id: t.id, archived: true });
    console.log(`  ✓ Archived: ${t.label} [${t.id}]`);
    results.push({ id: t.id, status: 'archived' });
  } catch (err) {
    console.error(`  ✗ FAILED: ${t.label} [${t.id}] — ${err.message}`);
    results.push({ id: t.id, status: 'error', error: err.message });
  }
}

console.log('\nSummary:');
const archived = results.filter((r) => r.status === 'archived').length;
const skipped = results.filter((r) => r.status === 'already_archived').length;
const failed = results.filter((r) => r.status === 'error').length;
console.log(`  archived: ${archived}`);
console.log(`  already archived: ${skipped}`);
console.log(`  failed: ${failed}`);

if (failed > 0) process.exit(1);
