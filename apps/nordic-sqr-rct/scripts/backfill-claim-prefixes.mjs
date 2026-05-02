#!/usr/bin/env node
/**
 * Backfill Claim Prefix + Core Benefit relations on existing PCS Claims.
 *
 * Multi-profile architecture (Week 2) — added 2026-04-19.
 *
 * Run:
 *   node scripts/backfill-claim-prefixes.mjs              # live, all candidates
 *   node scripts/backfill-claim-prefixes.mjs --dry-run    # preview only
 *   node scripts/backfill-claim-prefixes.mjs --limit=5    # cap batch size
 *   node scripts/backfill-claim-prefixes.mjs --dry-run --limit=12
 *
 * Env: reads .env.local (NOTION_TOKEN, NOTION_PCS_*, LLM_API_KEY, LLM_MODEL).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Load env (same pattern as scripts/migrate-lauren-template.mjs) ─────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
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

const required = ['NOTION_TOKEN', 'LLM_API_KEY'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing required env: ${k}`);
    process.exit(1);
  }
}

// ─── Parse args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
let limit;
for (const a of args) {
  const m = a.match(/^--limit=(\d+)$/);
  if (m) limit = Number(m[1]);
}

// ─── Run backfill ───────────────────────────────────────────────────────────
const { runClaimPrefixBackfill } = await import('../src/lib/claim-backfill.js');

console.log(`\n=== Backfill Claim Prefixes & Core Benefits ===`);
console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
if (limit) console.log(`Limit: ${limit} claims`);
console.log('');

const results = await runClaimPrefixBackfill({
  dryRun,
  limit,
  log: (line) => console.log(line),
});

console.log('\n=== Summary ===');
console.log(JSON.stringify(results.summary, null, 2));

if (results.failed.length > 0) {
  console.log('\n=== Failures ===');
  for (const f of results.failed) {
    console.log(`  ${f.claimNo || f.id}: ${f.reason}`);
  }
  process.exit(1);
}
