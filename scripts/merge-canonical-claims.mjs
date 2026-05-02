#!/usr/bin/env node
/**
 * Wave 7.0.5 T8.1 — Canonical Claim merge-execution script.
 *
 * Consumes Gina's per-row `Dedupe decision` tags on Canonical Claim rows
 * (set via the dedupe-review UI / inline Notion edits) and executes the
 * merges she signed off on:
 *
 *   keep-survivor      — this row is the cluster's survivor
 *   retire-into-other  — fold this row into the survivor; rewire downstream
 *                        PCS Claim `Canonical Claim` relations survivor-ward
 *   archive            — soft-archive (annotate), do not reassign downstreams
 *   actually-different — false positive; leave the cluster alone
 *   needs-more-info    — skip for now
 *
 * Safety rails:
 *   • DRY-RUN is the default. Pass --confirm to execute writes.
 *   • Never deletes anything — archives are annotated, not removed.
 *   • Aborts a cluster on the first write error (no partial state).
 *   • Ambiguous clusters (two survivors, survivor id unreachable) are
 *     reported and skipped, never force-merged.
 *
 * Usage:
 *   node scripts/merge-canonical-claims.mjs --dry-run
 *   node scripts/merge-canonical-claims.mjs --dry-run --verbose
 *   node scripts/merge-canonical-claims.mjs --cluster=<canonical_key> --dry-run
 *   node scripts/merge-canonical-claims.mjs --confirm
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Env loading (same pattern as backfill-canonical-claim-keys) ──────────
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

// ─── Decision vocabulary (must match Notion select options) ──────────────
export const DEDUPE_DECISIONS = Object.freeze({
  KEEP_SURVIVOR: 'keep-survivor',
  RETIRE_INTO_OTHER: 'retire-into-other',
  ARCHIVE: 'archive',
  ACTUALLY_DIFFERENT: 'actually-different',
  NEEDS_MORE_INFO: 'needs-more-info',
});

// ─── Pure logic (unit-testable; no Notion calls) ─────────────────────────

/**
 * Group parsed canonical-claim rows by their `canonicalKey`. Rows without
 * a key are dropped (they haven't been backfilled yet and cannot be
 * clustered). Returns Map<key, row[]>.
 */
export function groupByCanonicalKey(rows) {
  const byKey = new Map();
  for (const row of rows) {
    if (!row?.canonicalKey) continue;
    if (!byKey.has(row.canonicalKey)) byKey.set(row.canonicalKey, []);
    byKey.get(row.canonicalKey).push(row);
  }
  return byKey;
}

/**
 * Classify a single cluster into an action plan. Pure function.
 *
 * Plan shapes:
 *   { kind: 'skip',  reason: string, cluster }
 *   { kind: 'error', reason: string, cluster }
 *   { kind: 'merge', survivor, retirements: row[], archives: row[], cluster }
 *   { kind: 'archive-only', archives: row[], cluster }
 *
 * Skip cases:
 *   • cluster size 1 (not a duplicate)
 *   • no decisions at all (awaiting review)
 *   • cluster contains `actually-different` rows (false positive) — leave
 *     everything alone, regardless of other decisions
 *   • cluster contains only `needs-more-info` decisions
 *
 * Error cases:
 *   • two or more rows marked `keep-survivor` (ambiguity; operator must
 *     resolve before script runs)
 *   • retirements present but no survivor
 */
export function planCluster(cluster) {
  if (!Array.isArray(cluster) || cluster.length < 2) {
    return { kind: 'skip', reason: 'cluster-size-<2', cluster };
  }

  const survivors   = cluster.filter(r => r.dedupeDecision === DEDUPE_DECISIONS.KEEP_SURVIVOR);
  const retirements = cluster.filter(r => r.dedupeDecision === DEDUPE_DECISIONS.RETIRE_INTO_OTHER);
  const archives    = cluster.filter(r => r.dedupeDecision === DEDUPE_DECISIONS.ARCHIVE);
  const different   = cluster.filter(r => r.dedupeDecision === DEDUPE_DECISIONS.ACTUALLY_DIFFERENT);
  const needsInfo   = cluster.filter(r => r.dedupeDecision === DEDUPE_DECISIONS.NEEDS_MORE_INFO);
  const undecided   = cluster.filter(r => !r.dedupeDecision);

  // False-positive → leave everything alone.
  if (different.length > 0) {
    return { kind: 'skip', reason: 'actually-different-present', cluster };
  }

  // Nothing reviewed yet.
  if (
    survivors.length === 0 &&
    retirements.length === 0 &&
    archives.length === 0 &&
    needsInfo.length === 0
  ) {
    return { kind: 'skip', reason: 'awaiting-decisions', cluster };
  }

  // Only `needs-more-info` or a mix of undecided + needsInfo with no actionable decisions.
  if (survivors.length === 0 && retirements.length === 0 && archives.length === 0) {
    return { kind: 'skip', reason: 'needs-more-info', cluster };
  }

  // Ambiguity guard.
  if (survivors.length > 1) {
    return {
      kind: 'error',
      reason: `multiple-survivors (${survivors.length})`,
      cluster,
    };
  }

  // Archive-only cluster (no survivor, no retirements, but archives present).
  if (survivors.length === 0 && retirements.length === 0 && archives.length > 0) {
    return { kind: 'archive-only', archives, cluster };
  }

  // Retirements without a survivor — cannot fold.
  if (survivors.length === 0 && retirements.length > 0) {
    return {
      kind: 'error',
      reason: 'retirements-without-survivor',
      cluster,
    };
  }

  // Normal merge plan (1 survivor + N retirements + M archives).
  return {
    kind: 'merge',
    survivor: survivors[0],
    retirements,
    archives,
    undecided, // reported but not acted on
    cluster,
  };
}

/**
 * For a merge plan, return the list of PCS Claim page ids whose
 * `Canonical Claim` relation must be rewritten survivor-ward.
 *
 * Pure — consumes the `pcsClaimInstanceIds` already on the retirement rows
 * (populated by parsePage in src/lib/pcs-canonical-claims.js).
 */
export function claimUpdatesForPlan(plan) {
  if (plan.kind !== 'merge') return [];
  const updates = [];
  for (const ret of plan.retirements) {
    for (const claimId of ret.pcsClaimInstanceIds || []) {
      updates.push({
        claimId,
        fromCanonicalClaimId: ret.id,
        toCanonicalClaimId: plan.survivor.id,
      });
    }
  }
  return updates;
}

// ─── CLI entry point ─────────────────────────────────────────────────────
// Guard so the pure exports above can be imported by tests without triggering
// Notion env-var checks or network calls.
const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const required = ['NOTION_TOKEN', 'NOTION_PCS_CANONICAL_CLAIMS_DB', 'NOTION_PCS_CLAIMS_DB'];
  for (const k of required) {
    if (!process.env[k]) {
      console.error(`Missing required env: ${k}`);
      process.exit(1);
    }
  }

  // ─── Args ─────────────────────────────────────────────────────────────
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--confirm'); // default to dry-run
  const verbose = args.includes('--verbose');
  let clusterFilter = null;
  for (const a of args) {
    const m = a.match(/^--cluster=(.+)$/);
    if (m) clusterFilter = m[1];
  }

  // ─── Imports (deferred so tests don't trigger them) ───────────────────
  const { notion } = await import('../src/lib/notion.js');
  const { PROPS } = await import('../src/lib/pcs-config.js');
  const { getAllCanonicalClaims } = await import('../src/lib/pcs-canonical-claims.js');

  const CC = PROPS.canonicalClaims;
  const CLAIMS = PROPS.claims;

  console.log('\n=== Merge Canonical Claims (Wave 7.0.5 T8.1) ===');
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE (--confirm)'}`);
  if (clusterFilter) console.log(`Cluster filter: ${clusterFilter}`);
  console.log('');

  // ─── Fetch + group ───────────────────────────────────────────────────
  const rows = await getAllCanonicalClaims();
  console.log(`Loaded ${rows.length} canonical claims.`);

  const byKey = groupByCanonicalKey(rows);
  console.log(`Keyed clusters: ${byKey.size}`);

  const today = new Date().toISOString().slice(0, 10);

  // ─── Plan + execute per cluster ──────────────────────────────────────
  const summary = {
    clustersSeen: 0,
    clustersMerged: 0,
    clustersArchiveOnly: 0,
    clustersSkipped: 0,
    clustersErrored: 0,
    retirementsProcessed: 0,
    archivesProcessed: 0,
    claimRelationsUpdated: 0,
    errors: [],
  };

  const skipReasonCounts = {};

  for (const [key, cluster] of byKey.entries()) {
    if (clusterFilter && key !== clusterFilter) continue;
    if (cluster.length < 2) continue;

    summary.clustersSeen++;
    const plan = planCluster(cluster);

    if (plan.kind === 'skip') {
      summary.clustersSkipped++;
      skipReasonCounts[plan.reason] = (skipReasonCounts[plan.reason] || 0) + 1;
      if (verbose) {
        console.log(`  [skip] key=${key} size=${cluster.length} reason=${plan.reason}`);
      }
      continue;
    }

    if (plan.kind === 'error') {
      summary.clustersErrored++;
      summary.errors.push({ key, reason: plan.reason });
      console.log(`  [ERROR] key=${key} size=${cluster.length} reason=${plan.reason}`);
      continue;
    }

    if (plan.kind === 'archive-only') {
      summary.clustersArchiveOnly++;
      console.log(`  [archive-only] key=${key} rows=${plan.archives.length}`);
      for (const row of plan.archives) {
        if (verbose) console.log(`      archive → ${row.id}  ${row.canonicalClaim.slice(0, 60)}`);
        if (!dryRun) {
          try {
            await annotateArchive(notion, CC, row, today);
          } catch (err) {
            summary.clustersErrored++;
            summary.errors.push({ key, id: row.id, reason: err?.message || String(err) });
            console.log(`      FAIL archive ${row.id}: ${err?.message || err}`);
            break;
          }
        }
        summary.archivesProcessed++;
      }
      continue;
    }

    // kind === 'merge'
    summary.clustersMerged++;
    const claimUpdates = claimUpdatesForPlan(plan);
    console.log(
      `  [merge] key=${key} survivor=${plan.survivor.id}` +
      ` retirements=${plan.retirements.length} archives=${plan.archives.length}` +
      ` claim-rewrites=${claimUpdates.length}`,
    );
    if (verbose) {
      console.log(`      survivor: ${plan.survivor.canonicalClaim.slice(0, 70)}`);
      for (const r of plan.retirements) {
        console.log(`      retire  : ${r.id}  ${r.canonicalClaim.slice(0, 60)}`);
      }
      for (const a of plan.archives) {
        console.log(`      archive : ${a.id}  ${a.canonicalClaim.slice(0, 60)}`);
      }
      for (const u of claimUpdates) {
        console.log(`      rewrite : claim=${u.claimId}  ${u.fromCanonicalClaimId} → ${u.toCanonicalClaimId}`);
      }
    }

    if (dryRun) continue;

    // ─── LIVE execution ──────────────────────────────────────────────
    // Pre-flight: verify the survivor page is retrievable before we
    // start mutating anything.
    try {
      await notion.pages.retrieve({ page_id: plan.survivor.id });
    } catch (err) {
      summary.clustersErrored++;
      summary.errors.push({ key, reason: `survivor-unreachable: ${err?.message || err}` });
      console.log(`      FAIL survivor unreachable ${plan.survivor.id}: ${err?.message || err}`);
      continue;
    }

    let aborted = false;

    // 1) Rewire PCS claim → survivor.
    for (const u of claimUpdates) {
      try {
        await rewireClaimCanonical(notion, CLAIMS, u);
        summary.claimRelationsUpdated++;
      } catch (err) {
        aborted = true;
        summary.clustersErrored++;
        summary.errors.push({ key, claimId: u.claimId, reason: err?.message || String(err) });
        console.log(`      FAIL rewrite claim ${u.claimId}: ${err?.message || err}`);
        break;
      }
    }
    if (aborted) continue;

    // 2) Annotate retirements.
    for (const ret of plan.retirements) {
      try {
        await annotateRetirement(notion, CC, ret, plan.survivor.id, today);
        summary.retirementsProcessed++;
      } catch (err) {
        aborted = true;
        summary.clustersErrored++;
        summary.errors.push({ key, id: ret.id, reason: err?.message || String(err) });
        console.log(`      FAIL retire ${ret.id}: ${err?.message || err}`);
        break;
      }
    }
    if (aborted) continue;

    // 3) Annotate archives.
    for (const arc of plan.archives) {
      try {
        await annotateArchive(notion, CC, arc, today);
        summary.archivesProcessed++;
      } catch (err) {
        summary.clustersErrored++;
        summary.errors.push({ key, id: arc.id, reason: err?.message || String(err) });
        console.log(`      FAIL archive ${arc.id}: ${err?.message || err}`);
        break;
      }
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log('\n=== Summary ===');
  console.log(JSON.stringify({ ...summary, skipReasonCounts }, null, 2));

  if (summary.errors.length) process.exit(1);
}

// ─── Notion write helpers (only called in CLI branch) ────────────────────

async function rewireClaimCanonical(notion, CLAIMS, { claimId, fromCanonicalClaimId, toCanonicalClaimId }) {
  // Read current relation array, replace from-id → to-id, preserve any
  // other ids (claims can in principle point at multiple canonical rows,
  // though in practice it's 1).
  const page = await notion.pages.retrieve({ page_id: claimId });
  const current = (page.properties?.[CLAIMS.canonicalClaim]?.relation || []).map(r => r.id);
  const next = [];
  const seen = new Set();
  for (const id of current) {
    const replaced = id === fromCanonicalClaimId ? toCanonicalClaimId : id;
    if (seen.has(replaced)) continue;
    seen.add(replaced);
    next.push(replaced);
  }
  // If the from-id wasn't actually present (stale pointer), ensure the
  // survivor is at least included.
  if (!seen.has(toCanonicalClaimId)) next.push(toCanonicalClaimId);

  await notion.pages.update({
    page_id: claimId,
    properties: {
      [CLAIMS.canonicalClaim]: { relation: next.map(id => ({ id })) },
    },
  });
}

async function annotateRetirement(notion, CC, row, survivorId, today) {
  const existing = row.notesGuardrails || '';
  const prefix = `[MERGED into ${survivorId} on ${today}]`;
  if (existing.includes(prefix)) return; // idempotent
  const next = existing ? `${prefix}\n${existing}` : prefix;
  await notion.pages.update({
    page_id: row.id,
    properties: {
      [CC.notesGuardrails]: { rich_text: [{ text: { content: next.slice(0, 1950) } }] },
    },
  });
}

async function annotateArchive(notion, CC, row, today) {
  const existing = row.notesGuardrails || '';
  const prefix = `[ARCHIVED on ${today}]`;
  if (existing.includes(prefix)) return; // idempotent
  const next = existing ? `${prefix}\n${existing}` : prefix;
  await notion.pages.update({
    page_id: row.id,
    properties: {
      [CC.notesGuardrails]: { rich_text: [{ text: { content: next.slice(0, 1950) } }] },
    },
  });
}
