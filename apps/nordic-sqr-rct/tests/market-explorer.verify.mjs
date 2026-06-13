#!/usr/bin/env node
/**
 * Verification harness for the Budget C Market Explorer preview.
 *
 * Tests:
 *   1. New capabilities are present in CAPABILITIES and SUPER_USER_ONLY_CAPABILITIES
 *   2. No non-super-user role is granted the new capabilities
 *   3. Super-user is granted both new capabilities (via Object.keys(CAPABILITIES))
 *   4. Substantiation status thresholds compute correctly for all three outcomes
 *   5. normalizeSqrScore handles full/partial/empty score objects
 *
 * Usage:
 *   node tests/market-explorer.verify.mjs
 */

import {
  CAPABILITIES,
  ROLE_CAPABILITY_MAP,
  SUPER_USER_ONLY_CAPABILITIES,
  can,
  capabilitiesFor,
} from '../src/lib/auth/capabilities.js';

import {
  SUBSTANTIATION_THRESHOLDS,
  computeSubstantiationStatus,
  normalizeSqrScore,
} from '../src/lib/pcs-explorer.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(v, msg) {
  if (!v) throw new Error(msg || 'Expected true, got false');
}

function assertFalse(v, msg) {
  if (v) throw new Error(msg || 'Expected false, got true');
}

function assertApprox(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg || 'assertApprox'}: expected ~${expected}, got ${actual}`);
  }
}

// ─── Capability registration ────────────────────────────────────────────────
console.log('\nCapability registration:');

test('pcs.market-explorer:view is in CAPABILITIES', () => {
  assertTrue('pcs.market-explorer:view' in CAPABILITIES);
});

test('pcs.dossier:export is in CAPABILITIES', () => {
  assertTrue('pcs.dossier:export' in CAPABILITIES);
});

test('pcs.market-explorer:view is in SUPER_USER_ONLY_CAPABILITIES', () => {
  assertTrue(SUPER_USER_ONLY_CAPABILITIES.has('pcs.market-explorer:view'));
});

test('pcs.dossier:export is in SUPER_USER_ONLY_CAPABILITIES', () => {
  assertTrue(SUPER_USER_ONLY_CAPABILITIES.has('pcs.dossier:export'));
});

// ─── Role gating ────────────────────────────────────────────────────────────
console.log('\nRole gating:');

const BLOCKED_ROLES = ['reviewer', 'researcher', 'ra', 'admin'];

for (const role of BLOCKED_ROLES) {
  test(`${role} does NOT have pcs.market-explorer:view`, () => {
    const caps = capabilitiesFor([role]);
    assertFalse(caps.has('pcs.market-explorer:view'), `${role} should be blocked`);
  });

  test(`${role} does NOT have pcs.dossier:export`, () => {
    const caps = capabilitiesFor([role]);
    assertFalse(caps.has('pcs.dossier:export'), `${role} should be blocked`);
  });
}

test('super-user has pcs.market-explorer:view', () => {
  const user = { roles: ['super-user'] };
  assertTrue(can(user, 'pcs.market-explorer:view'));
});

test('super-user has pcs.dossier:export', () => {
  const user = { roles: ['super-user'] };
  assertTrue(can(user, 'pcs.dossier:export'));
});

test('legacy admin role does NOT have pcs.market-explorer:view', () => {
  const user = { roles: ['admin'] };
  assertFalse(can(user, 'pcs.market-explorer:view'));
});

// ─── Substantiation thresholds ───────────────────────────────────────────────
console.log('\nSubstantiation thresholds (SUBSTANTIATION_THRESHOLDS):');

test('SUPPORTED_MIN_STUDIES is a positive integer', () => {
  assertTrue(Number.isInteger(SUBSTANTIATION_THRESHOLDS.SUPPORTED_MIN_STUDIES));
  assertTrue(SUBSTANTIATION_THRESHOLDS.SUPPORTED_MIN_STUDIES > 0);
});

test('SUPPORTED_MIN_SCORE is between 0.5 and 1', () => {
  const s = SUBSTANTIATION_THRESHOLDS.SUPPORTED_MIN_SCORE;
  assertTrue(s > 0.5 && s <= 1.0, `Expected 0.5 < score <= 1, got ${s}`);
});

test('THIN_MIN_SCORE < SUPPORTED_MIN_SCORE', () => {
  assertTrue(
    SUBSTANTIATION_THRESHOLDS.THIN_MIN_SCORE < SUBSTANTIATION_THRESHOLDS.SUPPORTED_MIN_SCORE,
    'THIN_MIN_SCORE must be less than SUPPORTED_MIN_SCORE'
  );
});

// ─── normalizeSqrScore ───────────────────────────────────────────────────────
console.log('\nnormalizeSqrScore:');

test('all 1s → 0.0', () => {
  const score = { q1:1, q2:1, q3:1, q4:1, q5:1, q6:1, q7:1, q8:1, q9:1, q10:1, q11:1 };
  assertApprox(normalizeSqrScore(score), 0.0, 0.001, 'all 1s should be 0.0');
});

test('all 3s → 1.0', () => {
  const score = { q1:3, q2:3, q3:3, q4:3, q5:3, q6:3, q7:3, q8:3, q9:3, q10:3, q11:3 };
  assertApprox(normalizeSqrScore(score), 1.0, 0.001, 'all 3s should be 1.0');
});

test('all 2s → 0.5', () => {
  const score = { q1:2, q2:2, q3:2, q4:2, q5:2, q6:2, q7:2, q8:2, q9:2, q10:2, q11:2 };
  assertApprox(normalizeSqrScore(score), 0.5, 0.001, 'all 2s should be 0.5');
});

test('empty/null score → null', () => {
  assertEqual(normalizeSqrScore({}), null, 'empty score should return null');
  assertEqual(normalizeSqrScore({ q1: null, q2: null }), null, 'all-null should return null');
});

test('partial score (5 answered) normalizes to that range', () => {
  const score = { q1:3, q2:3, q3:3, q4:3, q5:3 };
  const result = normalizeSqrScore(score);
  assertApprox(result, 1.0, 0.001, 'all 3s in partial should be 1.0');
});

// ─── computeSubstantiationStatus ────────────────────────────────────────────
console.log('\ncomputeSubstantiationStatus:');

function makeScore(level, evidenceId) {
  const q = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return {
    studyRelation: [evidenceId],
    q1:q, q2:q, q3:q, q4:q, q5:q, q6:q, q7:q, q8:q, q9:q, q10:q, q11:q,
  };
}

test('0 studies → Unsupported', () => {
  const { status } = computeSubstantiationStatus([], []);
  assertEqual(status, 'Unsupported');
});

test('2+ studies with high SQR-RCT → Supported', () => {
  const ev = [{ id: 'e1' }, { id: 'e2' }];
  const scores = [makeScore('high', 'e1'), makeScore('high', 'e2')];
  const { status } = computeSubstantiationStatus(ev, scores);
  assertEqual(status, 'Supported', '2 high-quality studies should be Supported');
});

test('2+ studies with low SQR-RCT → Unsupported', () => {
  const ev = [{ id: 'e1' }, { id: 'e2' }];
  const scores = [makeScore('low', 'e1'), makeScore('low', 'e2')];
  const { status } = computeSubstantiationStatus(ev, scores);
  assertEqual(status, 'Unsupported', '2 low-quality studies should be Unsupported');
});

test('1 study with high score → Thin (insufficient count)', () => {
  const ev = [{ id: 'e1' }];
  const scores = [makeScore('high', 'e1')];
  const { status } = computeSubstantiationStatus(ev, scores);
  assertEqual(status, 'Thin', '1 study regardless of quality should be Thin');
});

test('2+ studies with medium score → Thin', () => {
  const ev = [{ id: 'e1' }, { id: 'e2' }];
  const scores = [makeScore('medium', 'e1'), makeScore('medium', 'e2')];
  const { status } = computeSubstantiationStatus(ev, scores);
  assertEqual(status, 'Thin', '2 medium-quality studies should be Thin');
});

test('3 studies with no SQR-RCT scores → Thin (no quality data)', () => {
  const ev = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];
  const { status } = computeSubstantiationStatus(ev, []);
  // No scores → meanScore is null → can't confirm quality → Thin
  assertEqual(status, 'Thin', '3 studies with no SQR scores should be Thin');
});

test('statusInputs.evidenceCount reflects study count', () => {
  const ev = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];
  const { evidenceCount } = computeSubstantiationStatus(ev, []);
  assertEqual(evidenceCount, 3);
});

test('statusInputs.meanScore is a number when scores exist', () => {
  const ev = [{ id: 'e1' }, { id: 'e2' }];
  const scores = [makeScore('high', 'e1'), makeScore('high', 'e2')];
  const { meanScore } = computeSubstantiationStatus(ev, scores);
  assertTrue(typeof meanScore === 'number' && meanScore > 0, `expected positive meanScore, got ${meanScore}`);
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
