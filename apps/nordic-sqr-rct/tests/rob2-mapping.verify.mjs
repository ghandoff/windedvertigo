#!/usr/bin/env node
/**
 * Verification harness for src/lib/rob2-mapping.js
 *
 * Runs every decision branch of the RoB 2 mapping and prints a
 * pass/fail table. No external test framework required — plain Node.
 *
 * Usage:
 *   node tests/rob2-mapping.verify.js
 *
 * Exit code 0 if all assertions pass, 1 otherwise. Safe to wire
 * into a CI step or the Vercel build via `npm run verify:rob2`.
 */

import { mapRubricToRoB2, domain1, domain2, domain3, domain4, domain5, overallJudgment, JUDGMENTS } from '../src/lib/rob2-mapping.js';

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertion'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── Domain 1 ────────────────────────────────────────────────────────────
test('D1: Q2=2 + Q5=2 → Low', () => {
  assertEq(domain1({ q2: 2, q5: 2 }).judgment, JUDGMENTS.LOW);
});
test('D1: Q2=2 + Q5=1 → Low', () => {
  assertEq(domain1({ q2: 2, q5: 1 }).judgment, JUDGMENTS.LOW);
});
test('D1: Q2=2 + Q5=0 → Some concerns (imbalance suggests randomization failed)', () => {
  assertEq(domain1({ q2: 2, q5: 0 }).judgment, JUDGMENTS.SOME);
});
test('D1: Q2=1 → Some concerns', () => {
  assertEq(domain1({ q2: 1, q5: 2 }).judgment, JUDGMENTS.SOME);
});
test('D1: Q2=0 → High (no randomization)', () => {
  assertEq(domain1({ q2: 0, q5: 2 }).judgment, JUDGMENTS.HIGH);
});
test('D1: Q2=0 + Q5=0 → High (Q2 dominates)', () => {
  assertEq(domain1({ q2: 0, q5: 0 }).judgment, JUDGMENTS.HIGH);
});
test('D1: Q2 missing → Some concerns', () => {
  assertEq(domain1({ q5: 2 }).judgment, JUDGMENTS.SOME);
});

// ─── Domain 2 ────────────────────────────────────────────────────────────
test('D2: Q3=2 + Q7=2 + Q6=2 → Low', () => {
  assertEq(domain2({ q3: 2, q7: 2, q6: 2 }).judgment, JUDGMENTS.LOW);
});
test('D2: Q3=2 + Q7=1 + Q6=1 → Low', () => {
  assertEq(domain2({ q3: 2, q7: 1, q6: 1 }).judgment, JUDGMENTS.LOW);
});
test('D2: Q3=1 → Some concerns', () => {
  assertEq(domain2({ q3: 1, q7: 2, q6: 2 }).judgment, JUDGMENTS.SOME);
});
test('D2: Q3=0 → High', () => {
  assertEq(domain2({ q3: 0, q7: 2, q6: 2 }).judgment, JUDGMENTS.HIGH);
});
test('D2: Q6=0 → High (substantial attrition impact)', () => {
  assertEq(domain2({ q3: 2, q7: 2, q6: 0 }).judgment, JUDGMENTS.HIGH);
});
test('D2: All missing → Some concerns', () => {
  assertEq(domain2({}).judgment, JUDGMENTS.SOME);
});

// ─── Domain 3 ────────────────────────────────────────────────────────────
test('D3: Q6=2 + Q9=2 → Low', () => {
  assertEq(domain3({ q6: 2, q9: 2 }).judgment, JUDGMENTS.LOW);
});
test('D3: Q6=2 + Q9=1 → Low', () => {
  assertEq(domain3({ q6: 2, q9: 1 }).judgment, JUDGMENTS.LOW);
});
test('D3: Q6=2 + Q9=0 → Some concerns (no missing-data handling)', () => {
  assertEq(domain3({ q6: 2, q9: 0 }).judgment, JUDGMENTS.SOME);
});
test('D3: Q6=1 → Some concerns', () => {
  assertEq(domain3({ q6: 1, q9: 2 }).judgment, JUDGMENTS.SOME);
});
test('D3: Q6=0 → High', () => {
  assertEq(domain3({ q6: 0, q9: 2 }).judgment, JUDGMENTS.HIGH);
});
test('D3: both missing → Some concerns', () => {
  assertEq(domain3({}).judgment, JUDGMENTS.SOME);
});

// ─── Domain 4 ────────────────────────────────────────────────────────────
test('D4: Q8=2 + Q3=2 → Low', () => {
  assertEq(domain4({ q8: 2, q3: 2 }).judgment, JUDGMENTS.LOW);
});
test('D4: Q8=2 + Q3=1 → Low with caveat', () => {
  const r = domain4({ q8: 2, q3: 1 });
  assertEq(r.judgment, JUDGMENTS.LOW);
  if (!r.rationale.some(s => s.includes('subjective'))) {
    throw new Error('D4 Q8=2 Q3=1 should include subjective-outcome caveat');
  }
});
test('D4: Q8=1 → Some concerns', () => {
  assertEq(domain4({ q8: 1, q3: 2 }).judgment, JUDGMENTS.SOME);
});
test('D4: Q8=0 → High', () => {
  assertEq(domain4({ q8: 0, q3: 2 }).judgment, JUDGMENTS.HIGH);
});
test('D4: Q3=0 → High', () => {
  assertEq(domain4({ q8: 2, q3: 0 }).judgment, JUDGMENTS.HIGH);
});
test('D4: both missing → Some concerns', () => {
  assertEq(domain4({}).judgment, JUDGMENTS.SOME);
});

// ─── Domain 5 ────────────────────────────────────────────────────────────
test('D5: Q10=2 + registered=true → Low', () => {
  assertEq(domain5({ q10: 2, q12: true }).judgment, JUDGMENTS.LOW);
});
test('D5: Q10=2 + registered=false → Some concerns', () => {
  assertEq(domain5({ q10: 2, q12: false }).judgment, JUDGMENTS.SOME);
});
test('D5: Q10=2 + registration unknown (V1/V2) → Low with caveat', () => {
  const r = domain5({ q10: 2 });
  assertEq(r.judgment, JUDGMENTS.LOW);
  if (!r.rationale.some(s => s.includes('registration check not performed'))) {
    throw new Error('D5 Q10=2 without q12 should include registration caveat');
  }
});
test('D5: Q10=1 + registered=true → Some concerns', () => {
  assertEq(domain5({ q10: 1, q12: true }).judgment, JUDGMENTS.SOME);
});
test('D5: Q10=0 → High', () => {
  assertEq(domain5({ q10: 0 }).judgment, JUDGMENTS.HIGH);
});
test('D5: Q10 missing → Some concerns', () => {
  assertEq(domain5({}).judgment, JUDGMENTS.SOME);
});
test('D5: q12 accepts boolean true, string "Y", string "Yes", registrationFound=true', () => {
  assertEq(domain5({ q10: 2, q12: true }).judgment, JUDGMENTS.LOW);
  assertEq(domain5({ q10: 2, q12: 'Y' }).judgment, JUDGMENTS.LOW);
  assertEq(domain5({ q10: 2, q12: 'Yes' }).judgment, JUDGMENTS.LOW);
  assertEq(domain5({ q10: 2, registrationFound: true }).judgment, JUDGMENTS.LOW);
});

// ─── Overall (worst-domain-wins) ─────────────────────────────────────────
test('Overall: all Low → Low', () => {
  const domains = [{ judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.LOW }];
  assertEq(overallJudgment(domains), JUDGMENTS.LOW);
});
test('Overall: one Some + rest Low → Some concerns', () => {
  const domains = [{ judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.SOME }, { judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.LOW }];
  assertEq(overallJudgment(domains), JUDGMENTS.SOME);
});
test('Overall: one High → High', () => {
  const domains = [{ judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.SOME }, { judgment: JUDGMENTS.LOW }, { judgment: JUDGMENTS.HIGH }, { judgment: JUDGMENTS.LOW }];
  assertEq(overallJudgment(domains), JUDGMENTS.HIGH);
});
test('Overall: all High → High', () => {
  const domains = [{ judgment: JUDGMENTS.HIGH }, { judgment: JUDGMENTS.HIGH }, { judgment: JUDGMENTS.HIGH }, { judgment: JUDGMENTS.HIGH }, { judgment: JUDGMENTS.HIGH }];
  assertEq(overallJudgment(domains), JUDGMENTS.HIGH);
});

// ─── Full-map end-to-end (Sharon's reference examples) ───────────────────
test('E2E: Deshpande 2020 expected "Some concerns" — subjective primary outcome, unverified blinding', () => {
  // Deshpande: strong randomization + allocation concealment (Q2=2),
  // balanced baseline (Q5=2), double-blind (Q3=2), adequate sample
  // (Q4=2), baseline ok (Q5=2), low attrition with ITT (Q6=2),
  // interventions described (Q7=2), BUT subjective RSQ-W primary
  // outcome with unverified blinding pulls Q8 to 1 and Q3's blinding
  // caveat triggers. Pre-published protocol (Q10=2), registered.
  const scores = { q1: 2, q2: 2, q3: 2, q4: 2, q5: 2, q6: 2, q7: 2, q8: 1, q9: 2, q10: 2, q12: true };
  const result = mapRubricToRoB2(scores);
  assertEq(result.d4.judgment, JUDGMENTS.SOME, 'D4 should be Some concerns for unverified subjective blinding');
  assertEq(result.overall, JUDGMENTS.SOME, 'Overall should match Sharon\'s reference');
});

test('E2E: Salve 2019 expected "Some concerns" — no registration, per-protocol analysis', () => {
  // Salve: Q2=2 basic randomization, Q3=2 double-blind, Q5=2 baseline
  // comparable, Q6=1 minor attrition imbalance + per-protocol analysis
  // pushes Q9 to 1, Q8=1 subjective PSS primary. Q10=1 (limitations
  // acknowledged 2-3 bias types), NO trial registration (q12=false).
  const scores = { q1: 2, q2: 2, q3: 2, q4: 1, q5: 2, q6: 1, q7: 2, q8: 1, q9: 1, q10: 1, q12: false };
  const result = mapRubricToRoB2(scores);
  assertEq(result.d5.judgment, JUDGMENTS.SOME, 'D5 should be Some concerns for missing registration');
  assertEq(result.overall, JUDGMENTS.SOME, 'Overall should match Sharon\'s reference');
});

test('E2E: High-quality registered RCT → Low overall', () => {
  const scores = { q1: 2, q2: 2, q3: 2, q4: 2, q5: 2, q6: 2, q7: 2, q8: 2, q9: 2, q10: 2, q12: true };
  const result = mapRubricToRoB2(scores);
  assertEq(result.overall, JUDGMENTS.LOW);
  assertEq(result.d1.judgment, JUDGMENTS.LOW);
  assertEq(result.d2.judgment, JUDGMENTS.LOW);
  assertEq(result.d3.judgment, JUDGMENTS.LOW);
  assertEq(result.d4.judgment, JUDGMENTS.LOW);
  assertEq(result.d5.judgment, JUDGMENTS.LOW);
});

test('E2E: Weak RCT with no randomization → High overall', () => {
  const scores = { q1: 1, q2: 0, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 1, q9: 1, q10: 1 };
  const result = mapRubricToRoB2(scores);
  assertEq(result.d1.judgment, JUDGMENTS.HIGH);
  assertEq(result.overall, JUDGMENTS.HIGH);
});

test('E2E: output includes algorithm attribution and rubric contract', () => {
  const result = mapRubricToRoB2({ q1: 2, q2: 2, q3: 2, q4: 2, q5: 2, q6: 2, q7: 2, q8: 2, q9: 2, q10: 2 });
  if (!result.algorithm.includes('worst-domain-wins')) throw new Error('missing algorithm attribution');
  if (!result.rubricContract.includes('Nordic SQR-RCT')) throw new Error('missing rubric contract');
});

// ─── Run ─────────────────────────────────────────────────────────────────
console.log(`\nNordic SQR-RCT → Cochrane RoB 2 mapping verification\n${'─'.repeat(60)}`);
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`  \u2713 ${t.name}`);
  } catch (err) {
    failed++;
    console.log(`  \u2717 ${t.name}`);
    console.log(`      ${err.message}`);
  }
}
console.log(`${'─'.repeat(60)}\n${passed} passed, ${failed} failed (${tests.length} total)\n`);
process.exit(failed > 0 ? 1 : 0);
