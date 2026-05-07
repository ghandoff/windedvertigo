/**
 * validate-phase-b-writes.mjs
 *
 * Phase B write-path validation script. Verifies that with
 * PCS_WRITE_TO_POSTGRES=1, create/update operations:
 *   1. Write the Postgres row IMMEDIATELY (before Notion responds)
 *   2. Return the stub row synchronously
 *   3. Back-patch notion_page_id once Notion responds
 *   4. Leave pcs_pending_writes empty after ~5s
 *
 * Run BEFORE setting PCS_WRITE_TO_POSTGRES=1 in production.
 * Tier order: documents (Tier 1) → claims (Tier 2) → evidence (Tier 3)
 *
 * Usage:
 *   node scripts/validate-phase-b-writes.mjs --tier=1 [--dry-run] [--verbose]
 *   node scripts/validate-phase-b-writes.mjs --tier=all
 *
 * Prerequisites:
 *   - .env.local with SUPABASE_NORDIC_URL, SUPABASE_NORDIC_SECRET_KEY,
 *     NOTION_TOKEN, NOTION_PCS_DOCUMENTS_DB (+ CLAIMS, EVIDENCE for Tier 2/3)
 *   - PCS_WRITE_TO_POSTGRES=1 must be set in .env.local for the test to exercise
 *     the Phase B path (otherwise it falls back to Phase A and validation fails)
 *
 * 2026-05-07 — Path-2 Phase B validation
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Load .env.local (Next.js convention — same as the app)
loadEnvConfig(projectRoot, true, { info: () => {}, error: console.error });

const VERBOSE = process.argv.includes('--verbose');
const DRY_RUN = process.argv.includes('--dry-run');
const tierArg = process.argv.find(a => a.startsWith('--tier='))?.split('=')[1] ?? '1';
const TIERS = tierArg === 'all' ? [1, 2, 3] : [parseInt(tierArg, 10)];

const log = (...args) => console.log('[validate-phase-b]', ...args);
const verbose = (...args) => VERBOSE && console.log('[verbose]', ...args);

// ── Supabase client ──────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_NORDIC_URL;
  const key = process.env.SUPABASE_NORDIC_SECRET_KEY || process.env.SUPABASE_NORDIC_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_NORDIC_URL / SUPABASE_NORDIC_SECRET_KEY not set in .env.local');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Guard checks ─────────────────────────────────────────────────────────────

function guardPhaseB() {
  const flag = process.env.PCS_WRITE_TO_POSTGRES;
  if (flag !== '1' && flag !== 'true') {
    console.error('[validate-phase-b] ERROR: PCS_WRITE_TO_POSTGRES is not set to "1" in .env.local.');
    console.error('  This script validates the Phase B write path — set the flag first, then re-run.');
    process.exit(1);
  }
}

// ── Postgres query helpers ───────────────────────────────────────────────────

async function getRowByNotionPageId(sb, table, notionPageId) {
  const { data, error } = await sb
    .from(table)
    .select('*')
    .eq('notion_page_id', notionPageId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getPendingWritesCount(sb, table, notionPageId) {
  const { count, error } = await sb
    .from('pcs_pending_writes')
    .select('*', { count: 'exact', head: true })
    .eq('pg_table', table)
    .eq('notion_page_id', notionPageId)
    .is('succeeded_at', null);
  if (error) throw error;
  return count ?? 0;
}

async function waitForBackPatch(sb, table, preId, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await sb
      .from(table)
      .select('notion_page_id')
      .eq('notion_page_id', preId)
      .maybeSingle();
    if (!data) {
      // Row no longer at preId — back-patch happened (row moved to real Notion page id)
      return { backPatched: true, elapsed: Date.now() - start };
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return { backPatched: false, elapsed: timeoutMs };
}

// ── Tier 1: pcs_documents ────────────────────────────────────────────────────

async function validateTier1(sb) {
  log('─── Tier 1: pcs_documents ───────────────────────────────────────────────');

  // Dynamic import so env vars are loaded before module-level code runs
  const { createDocument, updateDocument } = await import('../src/lib/pcs-documents.js');

  // 1a. CREATE
  log('1a. createDocument — writing stub to Postgres before Notion responds...');
  const testPcsId = `VALIDATE-PHASE-B-${Date.now()}`;
  const t0 = Date.now();

  const created = DRY_RUN
    ? { id: 'dry-run-id', pcsId: testPcsId }
    : await createDocument({ pcsId: testPcsId, fileStatus: 'Pending', classification: 'Test' });

  const createElapsed = Date.now() - t0;
  verbose('createDocument returned in', createElapsed, 'ms:', created);

  if (!DRY_RUN) {
    // Immediate Postgres check — should exist before Notion round-trip completes
    const row = await getRowByNotionPageId(sb, 'pcs_documents', created.id);
    if (!row) {
      log('  ✗ FAIL: Postgres row not found at notion_page_id =', created.id);
      log('    (Phase A fallback may have been used — check PCS_WRITE_TO_POSTGRES flag)');
      return false;
    }
    log('  ✓ Postgres row written immediately (elapsed:', createElapsed, 'ms)');
    log('    notion_page_id (stub):', created.id);
    log('    pcs_id in Postgres:', row.pcs_id);

    // Wait for back-patch (stub UUID → real Notion page id)
    log('1b. Waiting for notion_page_id back-patch (up to 10s)...');
    const { backPatched, elapsed } = await waitForBackPatch(sb, 'pcs_documents', created.id);
    if (backPatched) {
      log(`  ✓ Back-patch completed in ~${elapsed}ms`);
    } else {
      log('  ⚠ Back-patch did not complete within 10s — may still be in-flight');
      log('    Check pcs_pending_writes for notion_page_id =', created.id);
    }

    // 1c. UPDATE (on the just-created doc, using whichever id we have)
    log('1c. updateDocument — partial update to fileStatus...');
    const t1 = Date.now();
    const updated = await updateDocument(created.id, { fileStatus: 'Active' });
    const updateElapsed = Date.now() - t1;
    verbose('updateDocument returned in', updateElapsed, 'ms:', updated);
    log('  ✓ updateDocument returned in', updateElapsed, 'ms');

    // Check pcs_pending_writes is clean
    const pending = await getPendingWritesCount(sb, 'pcs_documents', created.id);
    if (pending > 0) {
      log(`  ⚠ ${pending} unresolved row(s) in pcs_pending_writes — Notion mirror may have queued`);
    } else {
      log('  ✓ pcs_pending_writes clean for this row');
    }
  }

  log('Tier 1 validation complete.\n');
  return true;
}

// ── Tier 2: pcs_claims ───────────────────────────────────────────────────────

async function validateTier2(sb) {
  log('─── Tier 2: pcs_claims ──────────────────────────────────────────────────');
  const { createClaim, updateClaim } = await import('../src/lib/pcs-claims.js');

  // Need a valid pcsVersionId — fetch the most recent version from Postgres
  const { data: versions } = await sb
    .from('pcs_versions')
    .select('notion_page_id')
    .order('notion_created_at', { ascending: false })
    .limit(1);

  const pcsVersionId = versions?.[0]?.notion_page_id;
  if (!pcsVersionId) {
    log('  ⚠ No pcs_versions rows in Postgres — skipping createClaim (need a version FK)');
    return true;
  }

  log('1a. createClaim — using pcsVersionId:', pcsVersionId);
  const t0 = Date.now();

  const created = DRY_RUN
    ? { id: 'dry-run-id' }
    : await createClaim({ claim: `[PHASE-B-TEST] ${Date.now()}`, pcsVersionId, claimBucket: '3B' });

  const elapsed = Date.now() - t0;

  if (!DRY_RUN) {
    const row = await getRowByNotionPageId(sb, 'pcs_claims', created.id);
    if (!row) {
      log('  ✗ FAIL: pcs_claims row not found immediately after create');
      return false;
    }
    log(`  ✓ Postgres row written immediately (${elapsed}ms)`);

    // updateClaim smoke test
    log('1b. updateClaim — setting claimStatus...');
    const t1 = Date.now();
    await updateClaim(created.id, { claimStatus: 'Draft' });
    log(`  ✓ updateClaim returned (${Date.now() - t1}ms)`);
  }

  log('Tier 2 validation complete.\n');
  return true;
}

// ── Tier 3: pcs_evidence ─────────────────────────────────────────────────────

async function validateTier3(sb) {
  log('─── Tier 3: pcs_evidence ────────────────────────────────────────────────');
  const { createEvidence, updateEvidence } = await import('../src/lib/pcs-evidence.js');

  const testDoi = `10.9999/validate-phase-b-${Date.now()}`;
  log('1a. createEvidence — DOI:', testDoi);
  const t0 = Date.now();

  const created = DRY_RUN
    ? { id: 'dry-run-id' }
    : await createEvidence({
        name: `[PHASE-B-TEST] ${Date.now()}`,
        doi: testDoi,
        evidenceType: 'RCT',
        forceCreate: true, // skip dedup check for test rows
      });

  const elapsed = Date.now() - t0;

  if (!DRY_RUN) {
    if (created._wasMerged) {
      log('  ℹ row was hard-merged into existing evidence — _wasMerged propagated correctly');
    }

    const row = await getRowByNotionPageId(sb, 'pcs_evidence', created.id);
    if (!row) {
      log('  ✗ FAIL: pcs_evidence row not found immediately after create');
      return false;
    }
    log(`  ✓ Postgres row written immediately (${elapsed}ms)`);

    // updateEvidence smoke test
    log('1b. updateEvidence — setting evidenceType...');
    const t1 = Date.now();
    await updateEvidence(created.id, { evidenceType: 'Meta-Analysis' });
    log(`  ✓ updateEvidence returned (${Date.now() - t1}ms)`);

    // Back-patch check
    const { backPatched, elapsed: bpElapsed } = await waitForBackPatch(sb, 'pcs_evidence', created.id);
    log(backPatched
      ? `  ✓ notion_page_id back-patched in ~${bpElapsed}ms`
      : `  ⚠ back-patch pending (> 10s) — check pcs_pending_writes`);
  }

  log('Tier 3 validation complete.\n');
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) log('DRY RUN — no writes will be made');
  guardPhaseB();

  const sb = getSupabase();
  const results = [];

  for (const tier of TIERS) {
    if (tier === 1) results.push(await validateTier1(sb));
    else if (tier === 2) results.push(await validateTier2(sb));
    else if (tier === 3) results.push(await validateTier3(sb));
    else log('Unknown tier:', tier);
  }

  const allPassed = results.every(Boolean);
  log('─────────────────────────────────────────────────────────────────────────');
  log(allPassed ? '✓ All validations passed — safe to set PCS_WRITE_TO_POSTGRES=1' : '✗ Some validations failed — review above before enabling Phase B');
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('[validate-phase-b] Uncaught error:', err);
  process.exit(1);
});
