#!/usr/bin/env node
/**
 * scripts/backfill-password-hashes-to-supabase.mjs  —  Path 3 Phase 5 auth
 *
 * One-time migration that copies bcrypt password hashes from Notion into the
 * Postgres `reviewers.password_hash` column.
 *
 * Prerequisites:
 *   1. scripts/backfill-bcrypt-passwords.mjs has been run — all Notion
 *      `Password` fields are now bcrypt hashes (not plain-text).
 *   2. supabase/migrations/..._001_initial_schema.sql has been applied —
 *      the `reviewers.password_hash` column exists.
 *
 * Safety:
 *   - Only writes rows where the Notion password starts with a bcrypt signature
 *     ($2a$, $2b$, $2y$). Refuses to write plain-text or empty values.
 *   - Idempotent: re-running overwrites with the same hash (no harm).
 *   - Matches by `notion_page_id` so it's safe to re-run after a full backfill.
 *
 * Flags:
 *   --dry-run   Print what would change, don't write.
 *   --verbose   Log every row.
 *
 * Usage:
 *   cd apps/nordic-sqr-rct
 *   node scripts/backfill-password-hashes-to-supabase.mjs --dry-run
 *   node scripts/backfill-password-hashes-to-supabase.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

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

const { notion } = await import('../src/lib/notion.js');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

const SUPABASE_URL = process.env.SUPABASE_NORDIC_URL;
const SUPABASE_KEY = process.env.SUPABASE_NORDIC_SECRET_KEY || process.env.SUPABASE_NORDIC_SERVICE_KEY;
const NOTION_REVIEWER_DB = process.env.NOTION_REVIEWER_DB;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[backfill-pw-hashes] Missing SUPABASE_NORDIC_URL or SUPABASE_NORDIC_SECRET_KEY');
  process.exit(1);
}
if (!NOTION_REVIEWER_DB) {
  console.error('[backfill-pw-hashes] Missing NOTION_REVIEWER_DB');
  process.exit(1);
}

const BCRYPT_SIGNATURES = ['$2a$', '$2b$', '$2y$'];

function isBcrypt(s) {
  return typeof s === 'string' && BCRYPT_SIGNATURES.some(sig => s.startsWith(sig));
}

async function main() {
  console.log(`[backfill-pw-hashes] mode=${DRY_RUN ? 'DRY-RUN' : 'LIVE'}${VERBOSE ? ' verbose' : ''}`);

  // Fetch all reviewer pages from Notion
  const pages = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: NOTION_REVIEWER_DB,
      start_cursor: cursor,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  console.log(`[backfill-pw-hashes] fetched ${pages.length} reviewer(s) from Notion`);

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  let skippedEmpty = 0;
  let skippedPlaintext = 0;
  let written = 0;
  let errors = 0;

  for (const page of pages) {
    const hash = page.properties?.['Password']?.rich_text?.[0]?.plain_text || '';
    const alias = page.properties?.['Alias']?.rich_text?.[0]?.plain_text || page.id;

    if (!hash) {
      skippedEmpty++;
      if (VERBOSE) console.log(`  [skip empty] ${alias}`);
      continue;
    }
    if (!isBcrypt(hash)) {
      skippedPlaintext++;
      console.warn(`  [skip plaintext] ${alias} — run backfill-bcrypt-passwords.mjs first`);
      continue;
    }

    if (DRY_RUN) {
      written++;
      if (VERBOSE) console.log(`  [would write] ${alias} → ${hash.slice(0, 16)}...`);
      continue;
    }

    try {
      const { error } = await sb
        .from('reviewers')
        .update({ password_hash: hash })
        .eq('notion_page_id', page.id);
      if (error) throw error;
      written++;
      if (VERBOSE) console.log(`  [written] ${alias}`);
    } catch (err) {
      errors++;
      console.error(`  [error] ${alias}: ${err?.message || err}`);
    }
  }

  console.log('');
  console.log('[backfill-pw-hashes] summary:');
  console.log(`  total fetched:       ${pages.length}`);
  console.log(`  skipped (no hash):   ${skippedEmpty}`);
  console.log(`  skipped (plaintext): ${skippedPlaintext}`);
  if (DRY_RUN) {
    console.log(`  would write:         ${written}`);
  } else {
    console.log(`  written:             ${written}`);
    console.log(`  errors:              ${errors}`);
  }

  if (skippedPlaintext > 0) {
    console.log('');
    console.log('[backfill-pw-hashes] ACTION REQUIRED:');
    console.log('  Run scripts/backfill-bcrypt-passwords.mjs first to hash all plain-text passwords.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[backfill-pw-hashes] fatal:', err);
  process.exit(1);
});
