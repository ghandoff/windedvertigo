#!/usr/bin/env node
/**
 * scripts/backfill-bcrypt-passwords.mjs  —  Wave 7.0.7 Phase 0.1
 *
 * One-time migration that closes the "plain-text password in Notion" hole.
 *
 * Problem: the Reviewers DB stores `Password` as rich_text. Legacy rows
 * (pre-bcrypt-migration) still hold plain-text passwords — visible to Notion
 * staff and to anyone holding NOTION_TOKEN. Login auto-migrates to bcrypt on
 * a successful plain-text match, but any reviewer who hasn't logged in since
 * that code shipped is still at risk.
 *
 * Fix: iterate every Reviewer row; for each row whose `Password` field does
 * NOT start with a bcrypt signature (`$2a$` / `$2b$` / `$2y$`):
 *   1. Replace the stored plain-text value with a bcrypt hash of THAT same
 *      password. The reviewer's existing password still works — the Notion
 *      row just no longer exposes it in the clear.
 *   2. Set `Password reset required = true` so their next successful login
 *      immediately routes into /reset-password and they're forced to pick a
 *      new one (since the old one may have been seen by anyone with Notion
 *      workspace access during its plain-text lifetime).
 *
 * Net effect: reviewers never get locked out, but the security posture
 * advances in one step — no plain-text in Notion, and every previously-
 * exposed password gets rotated by its owner at next login.
 *
 * Flags:
 *   --dry-run         Print what would change, don't write.
 *   --limit=N         Cap at N rows (useful for sanity-checking in staging).
 *   --verbose         Log every row (otherwise just summary).
 *
 * Usage:
 *   node scripts/backfill-bcrypt-passwords.mjs --dry-run
 *   node scripts/backfill-bcrypt-passwords.mjs
 *
 * Requires: NOTION_TOKEN + NOTION_REVIEWER_DB in environment (from .env.local).
 *
 * Idempotent: re-running after a successful pass is a no-op — bcrypt'd rows
 * are skipped on the signature check.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

// Env loading — same pattern as scripts/backfill-canonical-claim-keys.mjs.
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

// Pull the shared Notion client + SDK query helpers AFTER env is set.
const { notion } = await import('../src/lib/notion.js');

const BCRYPT_ROUNDS = 12;
const BCRYPT_SIGNATURES = ['$2a$', '$2b$', '$2y$'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : Infinity;

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_REVIEWER_DB = process.env.NOTION_REVIEWER_DB;

if (!NOTION_TOKEN || !NOTION_REVIEWER_DB) {
  console.error('[backfill-bcrypt] Missing NOTION_TOKEN or NOTION_REVIEWER_DB in environment.');
  process.exit(1);
}

function looksLikeBcrypt(s) {
  return typeof s === 'string' && BCRYPT_SIGNATURES.some(sig => s.startsWith(sig));
}

function extractPassword(page) {
  return page.properties?.['Password']?.rich_text?.[0]?.plain_text ?? '';
}

function extractAlias(page) {
  return page.properties?.['Alias']?.rich_text?.[0]?.plain_text ?? '';
}

function extractEmail(page) {
  return page.properties?.['Email']?.email ?? '';
}

function extractFirstName(page) {
  return page.properties?.['First Name']?.title?.[0]?.plain_text ?? '';
}

async function fetchAllReviewers() {
  const out = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: NOTION_REVIEWER_DB,
      start_cursor: cursor,
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function main() {
  console.log(`[backfill-bcrypt] mode=${DRY_RUN ? 'DRY-RUN' : 'LIVE'}${VERBOSE ? ' verbose' : ''}${Number.isFinite(LIMIT) ? ` limit=${LIMIT}` : ''}`);

  const reviewers = await fetchAllReviewers();
  console.log(`[backfill-bcrypt] fetched ${reviewers.length} reviewer row(s)`);

  let alreadyHashed = 0;
  let empty = 0;
  let wouldMigrate = 0;
  let migrated = 0;
  let errors = 0;
  const sample = [];

  for (const page of reviewers) {
    if (migrated + wouldMigrate >= LIMIT) break;

    const alias = extractAlias(page);
    const email = extractEmail(page);
    const firstName = extractFirstName(page);
    const label = alias || email || firstName || page.id;
    const stored = extractPassword(page);

    if (!stored) {
      empty++;
      if (VERBOSE) console.log(`  [skip empty] ${label}`);
      continue;
    }
    if (looksLikeBcrypt(stored)) {
      alreadyHashed++;
      if (VERBOSE) console.log(`  [skip hashed] ${label}`);
      continue;
    }

    // Plain-text row. Bcrypt the EXISTING password (so login still works)
    // and flag for reset (so owner rotates on next login).
    const hashed = await bcrypt.hash(stored, BCRYPT_ROUNDS);

    if (DRY_RUN) {
      wouldMigrate++;
      if (sample.length < 5) sample.push(label);
      if (VERBOSE) console.log(`  [would migrate] ${label} (stored was ${stored.length}-char plain-text)`);
      continue;
    }

    try {
      await notion.pages.update({
        page_id: page.id,
        properties: {
          'Password': { rich_text: [{ text: { content: hashed } }] },
          'Password reset required': { checkbox: true },
        },
      });
      migrated++;
      if (sample.length < 5) sample.push(label);
      if (VERBOSE) console.log(`  [migrated] ${label}`);
    } catch (err) {
      errors++;
      console.error(`  [error] ${label}: ${err?.message || err}`);
    }
  }

  console.log('');
  console.log('[backfill-bcrypt] summary:');
  console.log(`  total fetched:      ${reviewers.length}`);
  console.log(`  already bcrypt:     ${alreadyHashed}`);
  console.log(`  empty password:     ${empty}`);
  if (DRY_RUN) {
    console.log(`  would migrate:      ${wouldMigrate}`);
  } else {
    console.log(`  migrated:           ${migrated}`);
    console.log(`  errors:             ${errors}`);
  }
  if (sample.length) {
    console.log(`  sample (up to 5):   ${sample.join(' · ')}`);
  }

  if (!DRY_RUN && migrated > 0) {
    console.log('');
    console.log('[backfill-bcrypt] next step:');
    console.log('  Affected reviewers must reset their password on next login.');
    console.log('  The login endpoint now routes "Password reset required" = true');
    console.log('  into /reset-password. Notify them out-of-band (email) that');
    console.log('  their password was reset for security reasons.');
  }
}

main().catch(err => {
  console.error('[backfill-bcrypt] fatal:', err);
  process.exit(1);
});
