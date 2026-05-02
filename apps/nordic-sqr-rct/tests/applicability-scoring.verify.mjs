#!/usr/bin/env node
/**
 * Verification harness for applicability scoring logic.
 * Runs: node tests/applicability-scoring.verify.mjs
 */

import { computeApplicabilityScore } from '../src/lib/applicability.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  \u2713 ${name}`); }
  catch (e) { failed++; console.log(`  \u2717 ${name}\n      ${e.message}`); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg||'eq'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

console.log(`\nApplicability scoring verification\n${'─'.repeat(60)}`);

// Empty / Pending
t('All nulls → Pending, null score', () => {
  const r = computeApplicabilityScore({});
  eq(r.rating, 'Pending'); eq(r.score, null); eq(r.domainsRated, 0);
});
t('All N/A → Pending, null score', () => {
  const r = computeApplicabilityScore({ doseMatch: 'N/A', formMatch: 'N/A', durationMatch: 'N/A', populationMatch: 'N/A', outcomeRelevance: 'N/A' });
  eq(r.rating, 'Pending'); eq(r.score, null); eq(r.domainsRated, 0);
});

// Perfect across all 5
t('All top-tier → 10.0 High', () => {
  const r = computeApplicabilityScore({
    doseMatch: 'Exact', formMatch: 'Exact match', durationMatch: 'Adequate',
    populationMatch: 'Exact', outcomeRelevance: 'Direct',
  });
  eq(r.score, 10); eq(r.rating, 'High'); eq(r.domainsRated, 5);
});

// All worst
t('All bottom-tier → 0 Low', () => {
  const r = computeApplicabilityScore({
    doseMatch: 'Outside range', formMatch: 'Different form', durationMatch: 'Insufficient',
    populationMatch: 'Different', outcomeRelevance: 'Indirect',
  });
  eq(r.score, 0); eq(r.rating, 'Low'); eq(r.domainsRated, 5);
});

// All middle tier → 5.0 Moderate
t('All middle-tier → 5.0 Moderate', () => {
  const r = computeApplicabilityScore({
    doseMatch: 'Within 10x', formMatch: 'Same class different form', durationMatch: 'Marginal',
    populationMatch: 'Close', outcomeRelevance: 'Validated surrogate',
  });
  eq(r.score, 5); eq(r.rating, 'Moderate');
});

// Partial rating handles N/A correctly — 3 of 5 at top = 10/10
t('Partial (3 top + 2 N/A) → 10.0 High', () => {
  const r = computeApplicabilityScore({
    doseMatch: 'Exact', formMatch: 'Exact match', durationMatch: 'N/A',
    populationMatch: 'Exact', outcomeRelevance: 'N/A',
  });
  eq(r.score, 10); eq(r.rating, 'High'); eq(r.domainsRated, 3);
});

// Threshold boundaries
t('Score = 8.0 → High (boundary)', () => {
  // 2+2+2+2+0 = 8/10 = 8.0 exactly
  const r = computeApplicabilityScore({
    doseMatch: 'Exact', formMatch: 'Exact match', durationMatch: 'Adequate',
    populationMatch: 'Exact', outcomeRelevance: 'Indirect',
  });
  eq(r.score, 8); eq(r.rating, 'High');
});
t('Score = 7.0 → Moderate (just below High)', () => {
  // Use 3 domains: 2+2+1 = 5/6 × 10 = 8.33 — nope. Try 2+1+1+1+2 = 7/10
  const r = computeApplicabilityScore({
    doseMatch: 'Exact', formMatch: 'Same class different form', durationMatch: 'Marginal',
    populationMatch: 'Close', outcomeRelevance: 'Direct',
  });
  eq(r.score, 7); eq(r.rating, 'Moderate');
});
t('Score = 4.something → Low (below 5)', () => {
  // 1+1+1+0+0 = 3/10
  const r = computeApplicabilityScore({
    doseMatch: 'Within 10x', formMatch: 'Same class different form', durationMatch: 'Marginal',
    populationMatch: 'Different', outcomeRelevance: 'Indirect',
  });
  eq(r.score, 3); eq(r.rating, 'Low');
});

// Robustness: unrecognized values ignored
t('Unknown option value → silently skipped', () => {
  const r = computeApplicabilityScore({
    doseMatch: 'gibberish', formMatch: 'Exact match', durationMatch: 'Adequate',
  });
  eq(r.domainsRated, 2);
  eq(r.score, 10);
  eq(r.rating, 'High');
});

console.log(`${'─'.repeat(60)}\n${passed} passed, ${failed} failed (${passed+failed} total)\n`);
process.exit(failed > 0 ? 1 : 0);
