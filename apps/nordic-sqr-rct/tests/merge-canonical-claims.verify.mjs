#!/usr/bin/env node
/**
 * Verification harness for scripts/merge-canonical-claims.mjs pure logic.
 * Runs: node tests/merge-canonical-claims.verify.mjs
 *
 * Tests the cluster classification + claim-rewire planning functions
 * without touching Notion.
 */

import {
  DEDUPE_DECISIONS,
  groupByCanonicalKey,
  planCluster,
  claimUpdatesForPlan,
} from '../scripts/merge-canonical-claims.mjs';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  \u2713 ${name}`); }
  catch (e) { failed++; console.log(`  \u2717 ${name}\n      ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'eq'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

const make = (id, decision, canonicalKey = 'k1', pcsClaimInstanceIds = []) => ({
  id,
  canonicalClaim: `row ${id}`,
  canonicalKey,
  dedupeDecision: decision,
  pcsClaimInstanceIds,
  notesGuardrails: '',
});

console.log(`\nmerge-canonical-claims pure-logic verification\n${'─'.repeat(60)}`);

// ─── groupByCanonicalKey ─────────────────────────────────────────────────
t('groupByCanonicalKey groups rows and drops null-key rows', () => {
  const rows = [
    make('a', null, 'k1'),
    make('b', null, 'k1'),
    make('c', null, 'k2'),
    { id: 'd', canonicalKey: null, dedupeDecision: null },
  ];
  const g = groupByCanonicalKey(rows);
  eq(g.size, 2, 'group count');
  eq(g.get('k1').length, 2, 'k1 size');
  eq(g.get('k2').length, 1, 'k2 size');
});

// ─── planCluster — happy path ────────────────────────────────────────────
t('1 survivor + 2 retirements → merge plan', () => {
  const cluster = [
    make('s', DEDUPE_DECISIONS.KEEP_SURVIVOR),
    make('r1', DEDUPE_DECISIONS.RETIRE_INTO_OTHER, 'k1', ['c1', 'c2']),
    make('r2', DEDUPE_DECISIONS.RETIRE_INTO_OTHER, 'k1', ['c3']),
  ];
  const plan = planCluster(cluster);
  eq(plan.kind, 'merge');
  eq(plan.survivor.id, 's');
  eq(plan.retirements.length, 2);
  eq(plan.archives.length, 0);
});

t('only archives → archive-only plan', () => {
  const cluster = [
    make('a1', DEDUPE_DECISIONS.ARCHIVE),
    make('a2', DEDUPE_DECISIONS.ARCHIVE),
  ];
  const plan = planCluster(cluster);
  eq(plan.kind, 'archive-only');
  eq(plan.archives.length, 2);
});

t('actually-different present → skip', () => {
  const cluster = [
    make('x', DEDUPE_DECISIONS.KEEP_SURVIVOR),
    make('y', DEDUPE_DECISIONS.ACTUALLY_DIFFERENT),
    make('z', DEDUPE_DECISIONS.RETIRE_INTO_OTHER),
  ];
  const plan = planCluster(cluster);
  eq(plan.kind, 'skip');
  eq(plan.reason, 'actually-different-present');
});

t('no decisions → skip awaiting-decisions', () => {
  const cluster = [make('a', null), make('b', null)];
  const plan = planCluster(cluster);
  eq(plan.kind, 'skip');
  eq(plan.reason, 'awaiting-decisions');
});

t('only needs-more-info → skip', () => {
  const cluster = [
    make('a', DEDUPE_DECISIONS.NEEDS_MORE_INFO),
    make('b', DEDUPE_DECISIONS.NEEDS_MORE_INFO),
  ];
  const plan = planCluster(cluster);
  eq(plan.kind, 'skip');
  eq(plan.reason, 'needs-more-info');
});

t('two survivors → error ambiguity', () => {
  const cluster = [
    make('a', DEDUPE_DECISIONS.KEEP_SURVIVOR),
    make('b', DEDUPE_DECISIONS.KEEP_SURVIVOR),
    make('c', DEDUPE_DECISIONS.RETIRE_INTO_OTHER),
  ];
  const plan = planCluster(cluster);
  eq(plan.kind, 'error');
  if (!plan.reason.startsWith('multiple-survivors')) {
    throw new Error(`unexpected reason: ${plan.reason}`);
  }
});

t('retirements without survivor → error', () => {
  const cluster = [
    make('a', DEDUPE_DECISIONS.RETIRE_INTO_OTHER),
    make('b', DEDUPE_DECISIONS.RETIRE_INTO_OTHER),
  ];
  const plan = planCluster(cluster);
  eq(plan.kind, 'error');
  eq(plan.reason, 'retirements-without-survivor');
});

t('cluster size 1 → skip', () => {
  const plan = planCluster([make('a', DEDUPE_DECISIONS.KEEP_SURVIVOR)]);
  eq(plan.kind, 'skip');
  eq(plan.reason, 'cluster-size-<2');
});

// ─── claimUpdatesForPlan ─────────────────────────────────────────────────
t('retirement with 0 PCS claim refs → no claim updates needed', () => {
  const cluster = [
    make('s', DEDUPE_DECISIONS.KEEP_SURVIVOR),
    make('r', DEDUPE_DECISIONS.RETIRE_INTO_OTHER, 'k1', []),
  ];
  const plan = planCluster(cluster);
  const updates = claimUpdatesForPlan(plan);
  eq(updates.length, 0);
});

t('retirement with 5 PCS claim refs → 5 claim updates', () => {
  const cluster = [
    make('s', DEDUPE_DECISIONS.KEEP_SURVIVOR),
    make('r', DEDUPE_DECISIONS.RETIRE_INTO_OTHER, 'k1', ['c1','c2','c3','c4','c5']),
  ];
  const plan = planCluster(cluster);
  const updates = claimUpdatesForPlan(plan);
  eq(updates.length, 5);
  eq(updates[0].fromCanonicalClaimId, 'r');
  eq(updates[0].toCanonicalClaimId, 's');
});

t('claimUpdatesForPlan on non-merge plan → []', () => {
  const cluster = [
    make('a', DEDUPE_DECISIONS.ARCHIVE),
    make('b', DEDUPE_DECISIONS.ARCHIVE),
  ];
  const plan = planCluster(cluster);
  eq(claimUpdatesForPlan(plan).length, 0);
});

// ─── Result ──────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
