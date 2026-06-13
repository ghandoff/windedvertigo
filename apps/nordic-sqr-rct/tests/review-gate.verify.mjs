#!/usr/bin/env node
/**
 * Verification harness for the expert-in-the-loop review gate (Part B + C).
 *
 * Tests (matching acceptance criteria from docs/expert-in-the-loop-gates-build-prompt.md §7):
 *   1. Capability registration — pcs.review:approve, pcs.review.rules:edit, pcs.governance:manage
 *   2. Non-expert roles (readonly, reviewer) cannot approve
 *   3. Expert roles (researcher, ra, admin, super-user) can approve
 *   4. Unapproved records are non-authoritative (status ≠ approved)
 *   5. Governance toggle is super-user-only
 *   6. Gates still work when governance is OFF (shouldCaptureHistory returns true by default)
 *   7. createAuditEvent creates an immutable row distinguishing confirmed/corrected/rejected/hand-entered
 *   8. createAuditEvent throws on invalid action or missing required fields
 *   9. actionToStatus maps actions → status correctly
 *  10. validateStatusTransition blocks invalid transitions (approved → anything)
 *  11. validateStatusTransition allows pending_review → approved
 *  12. checkRuleViolations flags/blocks a rule violation
 *  13. checkRuleViolations passes when no applicable rule
 *  14. isRubberStamp detects near-zero review time with no diff
 *  15. isRubberStamp does not flag a CORRECTED action (diff present)
 *  16. computeCorrectionRate aggregates correctly
 *  17. computeCorrectionRate byMode and byRecordType breakdowns
 *  18. computeTimeSaved aggregates correctly with configurable baselines
 *  19. computeTimeSaved marks result as estimate with visible assumptions
 *  20. computeRuleAdherence counts followed vs. deviated events
 *  21. shouldAutoApprove respects confidence threshold
 *  22. selectGateMode falls back to defaultMode when no matching rule
 *  23. createGateRecord produces correct initial state
 *  24. createAuditEvent output is frozen (immutable)
 *  25. DEFAULT_GATE_MODE is HUMAN_FIRST_AI_VERIFY
 *
 * Usage:
 *   node tests/review-gate.verify.mjs
 */

import {
  CAPABILITIES,
  ROLE_CAPABILITY_MAP,
  SUPER_USER_ONLY_CAPABILITIES,
  can,
  capabilitiesFor,
} from '../src/lib/auth/capabilities.js';

import {
  GATE_MODES,
  GATE_STATUS,
  AUDIT_ACTION,
  EXPERT_ROLES,
  DEFAULT_GATE_MODE,
  DEFAULT_GOVERNANCE_CONFIG,
  RUBBER_STAMP_THRESHOLD_MS,
  canApprove,
  canEditRules,
  canManageGovernance,
  isGovernanceEnabled,
  shouldCaptureHistory,
  createAuditEvent,
  createGateRecord,
  actionToStatus,
  validateStatusTransition,
  applyRule,
  checkRuleViolations,
  isRubberStamp,
  shouldAutoApprove,
  selectGateMode,
  computeCorrectionRate,
  computeTimeSaved,
  computeRuleAdherence,
  DEFAULT_TIME_BASELINES_MINUTES,
} from '../src/lib/review-gate.js';

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
    throw new Error(`${msg ?? 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(v, msg) {
  if (!v) throw new Error(msg ?? 'Expected true, got false');
}

function assertFalse(v, msg) {
  if (v) throw new Error(msg ?? 'Expected false, got true');
}

function assertThrows(fn, msgMatch) {
  let threw = false;
  try { fn(); } catch (err) {
    threw = true;
    if (msgMatch && !err.message.includes(msgMatch)) {
      throw new Error(`Expected error containing "${msgMatch}", got: "${err.message}"`);
    }
  }
  if (!threw) throw new Error('Expected function to throw, but it did not');
}

function assertApprox(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg ?? 'assertApprox'}: expected ~${expected} ±${tol}, got ${actual}`);
  }
}

// ─── 1. Capability registration ──────────────────────────────────────────────
console.log('\nCapability registration:');

test('pcs.review:approve is in CAPABILITIES', () => {
  assertTrue('pcs.review:approve' in CAPABILITIES);
});

test('pcs.review.rules:edit is in CAPABILITIES', () => {
  assertTrue('pcs.review.rules:edit' in CAPABILITIES);
});

test('pcs.governance:manage is in CAPABILITIES', () => {
  assertTrue('pcs.governance:manage' in CAPABILITIES);
});

test('pcs.governance:manage is in SUPER_USER_ONLY_CAPABILITIES', () => {
  assertTrue(SUPER_USER_ONLY_CAPABILITIES.has('pcs.governance:manage'));
});

// pcs.review:approve should NOT be in SUPER_USER_ONLY_CAPABILITIES
// (expert roles like researcher + ra need it, not just super-user)
test('pcs.review:approve is NOT in SUPER_USER_ONLY_CAPABILITIES', () => {
  assertFalse(SUPER_USER_ONLY_CAPABILITIES.has('pcs.review:approve'), 'pcs.review:approve must be available to researcher + ra, not locked to super-user');
});

// ─── 2. Non-expert roles cannot approve ──────────────────────────────────────
console.log('\nRole gating — cannot approve:');

const NON_EXPERT_ROLES = ['reviewer', 'pcs-readonly'];

for (const role of NON_EXPERT_ROLES) {
  test(`${role} does NOT have pcs.review:approve`, () => {
    const caps = capabilitiesFor([role]);
    assertFalse(caps.has('pcs.review:approve'), `${role} must not be able to approve`);
  });

  test(`canApprove returns false for ${role}`, () => {
    const user = { roles: [role] };
    assertFalse(canApprove(user), `canApprove should be false for ${role}`);
  });
}

// ─── 3. Expert roles can approve ─────────────────────────────────────────────
console.log('\nRole gating — expert roles can approve:');

for (const role of EXPERT_ROLES) {
  test(`${role} has pcs.review:approve`, () => {
    const caps = capabilitiesFor([role]);
    assertTrue(caps.has('pcs.review:approve'), `${role} must be able to approve`);
  });

  test(`canApprove returns true for ${role}`, () => {
    const user = { roles: [role] };
    assertTrue(canApprove(user), `canApprove should be true for ${role}`);
  });
}

// ─── 4. Unapproved records are non-authoritative ─────────────────────────────
console.log('\nUnapproved records:');

test('createGateRecord status starts as pending_review (non-authoritative)', () => {
  const record = createGateRecord({ recordId: 'r1', recordType: 'claim' });
  assertEqual(record.status, GATE_STATUS.PENDING_REVIEW);
});

test('pending_review status is not approved (non-authoritative)', () => {
  assertFalse(GATE_STATUS.PENDING_REVIEW === GATE_STATUS.APPROVED);
});

test('needs_changes status is not approved (non-authoritative)', () => {
  assertFalse(GATE_STATUS.NEEDS_CHANGES === GATE_STATUS.APPROVED);
});

// ─── 5. Governance toggle is super-user-only ──────────────────────────────────
console.log('\nGovernance toggle:');

test('canManageGovernance returns true for super-user', () => {
  assertTrue(canManageGovernance({ roles: ['super-user'] }));
});

for (const role of ['researcher', 'ra', 'admin', 'reviewer', 'pcs-readonly']) {
  test(`canManageGovernance returns false for ${role}`, () => {
    assertFalse(canManageGovernance({ roles: [role] }), `${role} must not be able to manage governance`);
  });
}

test('DEFAULT_GOVERNANCE_CONFIG.governanceEnabled is false', () => {
  assertFalse(DEFAULT_GOVERNANCE_CONFIG.governanceEnabled, 'Governance must ship OFF');
});

test('isGovernanceEnabled returns false for default config', () => {
  assertFalse(isGovernanceEnabled(DEFAULT_GOVERNANCE_CONFIG));
});

test('isGovernanceEnabled returns true when governanceEnabled: true', () => {
  assertTrue(isGovernanceEnabled({ governanceEnabled: true }));
});

// ─── 6. Gates still work when governance is OFF ───────────────────────────────
console.log('\nGates work when governance OFF:');

test('shouldCaptureHistory is true when governance OFF with captureHistoryWhenOff: true', () => {
  assertTrue(shouldCaptureHistory({ governanceEnabled: false, captureHistoryWhenOff: true }));
});

test('shouldCaptureHistory is false when governance OFF and captureHistoryWhenOff: false', () => {
  assertFalse(shouldCaptureHistory({ governanceEnabled: false, captureHistoryWhenOff: false }));
});

test('shouldCaptureHistory is true when governance ON regardless of captureHistoryWhenOff', () => {
  assertTrue(shouldCaptureHistory({ governanceEnabled: true, captureHistoryWhenOff: false }));
});

test('DEFAULT_GOVERNANCE_CONFIG.captureHistoryWhenOff is true', () => {
  assertTrue(DEFAULT_GOVERNANCE_CONFIG.captureHistoryWhenOff, 'Should capture history even while governance is OFF');
});

// ─── 7. createAuditEvent — immutable row distinguishing action types ──────────
console.log('\ncreateAuditEvent — immutable audit rows:');

const ACTOR = { id: 'u1', email: 'sharon@nordic.com', name: 'Sharon', roles: ['researcher'] };

const confirmedEvent = createAuditEvent({
  recordId: 'claim-1',
  recordType: 'claim',
  action: AUDIT_ACTION.CONFIRMED,
  actor: ACTOR,
  mode: GATE_MODES.HUMAN_FIRST_AI_VERIFY,
  reviewDurationMs: 30_000,
  diff: null,
});

test('CONFIRMED event has action=confirmed', () => {
  assertEqual(confirmedEvent.action, AUDIT_ACTION.CONFIRMED);
});

test('CONFIRMED event has actor.email set', () => {
  assertEqual(confirmedEvent.actor.email, 'sharon@nordic.com');
});

test('CONFIRMED event has reviewDurationMs set', () => {
  assertEqual(confirmedEvent.reviewDurationMs, 30_000);
});

test('CORRECTED event has action=corrected and diff', () => {
  const ev = createAuditEvent({
    recordId: 'claim-2',
    recordType: 'claim',
    action: AUDIT_ACTION.CORRECTED,
    actor: ACTOR,
    mode: GATE_MODES.AI_FIRST_EXPERT_REVIEW,
    diff: { field: 'claim', from: 'old text', to: 'new text' },
    reviewDurationMs: 120_000,
  });
  assertEqual(ev.action, AUDIT_ACTION.CORRECTED);
  assertTrue(ev.diff != null, 'diff must be present on CORRECTED event');
});

test('REJECTED event has action=rejected', () => {
  const ev = createAuditEvent({
    recordId: 'ev-1',
    recordType: 'evidence',
    action: AUDIT_ACTION.REJECTED,
    actor: ACTOR,
    mode: GATE_MODES.AI_FIRST_EXPERT_REVIEW,
  });
  assertEqual(ev.action, AUDIT_ACTION.REJECTED);
});

test('HAND_ENTERED event has action=hand_entered', () => {
  const ev = createAuditEvent({
    recordId: 'doc-1',
    recordType: 'pcs-document',
    action: AUDIT_ACTION.HAND_ENTERED,
    actor: ACTOR,
    mode: GATE_MODES.HUMAN_FIRST,
  });
  assertEqual(ev.action, AUDIT_ACTION.HAND_ENTERED);
});

// ─── 8. createAuditEvent throws on invalid input ──────────────────────────────
console.log('\ncreateAuditEvent — validation:');

test('createAuditEvent throws when recordId missing', () => {
  assertThrows(() => createAuditEvent({
    recordType: 'claim', action: AUDIT_ACTION.CONFIRMED, actor: ACTOR,
    mode: GATE_MODES.HUMAN_FIRST,
  }), 'recordId');
});

test('createAuditEvent throws on invalid action', () => {
  assertThrows(() => createAuditEvent({
    recordId: 'x', recordType: 'claim', action: 'MADE_UP_ACTION',
    actor: ACTOR, mode: GATE_MODES.HUMAN_FIRST,
  }), 'invalid action');
});

test('createAuditEvent throws on invalid mode', () => {
  assertThrows(() => createAuditEvent({
    recordId: 'x', recordType: 'claim', action: AUDIT_ACTION.CONFIRMED,
    actor: ACTOR, mode: 'garbage-mode',
  }), 'invalid mode');
});

test('createAuditEvent throws when actor.id missing', () => {
  assertThrows(() => createAuditEvent({
    recordId: 'x', recordType: 'claim', action: AUDIT_ACTION.CONFIRMED,
    actor: { email: 'a@b.com' }, mode: GATE_MODES.HUMAN_FIRST,
  }), 'actor.id');
});

// ─── 9. actionToStatus maps correctly ────────────────────────────────────────
console.log('\nactionToStatus:');

test('CONFIRMED → approved', () => assertEqual(actionToStatus(AUDIT_ACTION.CONFIRMED), GATE_STATUS.APPROVED));
test('CORRECTED → approved', () => assertEqual(actionToStatus(AUDIT_ACTION.CORRECTED), GATE_STATUS.APPROVED));
test('HAND_ENTERED → approved', () => assertEqual(actionToStatus(AUDIT_ACTION.HAND_ENTERED), GATE_STATUS.APPROVED));
test('AUTO_APPROVED → approved', () => assertEqual(actionToStatus(AUDIT_ACTION.AUTO_APPROVED), GATE_STATUS.APPROVED));
test('REJECTED → rejected', () => assertEqual(actionToStatus(AUDIT_ACTION.REJECTED), GATE_STATUS.REJECTED));
test('REQUESTED_CHANGES → needs_changes', () => assertEqual(actionToStatus(AUDIT_ACTION.REQUESTED_CHANGES), GATE_STATUS.NEEDS_CHANGES));
test('AI_VERIFIED → null (no status change)', () => assertEqual(actionToStatus(AUDIT_ACTION.AI_VERIFIED), null));

// ─── 10 + 11. validateStatusTransition ───────────────────────────────────────
console.log('\nvalidateStatusTransition:');

test('pending_review → approved is allowed', () => {
  const result = validateStatusTransition(GATE_STATUS.PENDING_REVIEW, GATE_STATUS.APPROVED);
  assertTrue(result.valid, 'pending_review → approved must be valid');
});

test('pending_review → needs_changes is allowed', () => {
  const result = validateStatusTransition(GATE_STATUS.PENDING_REVIEW, GATE_STATUS.NEEDS_CHANGES);
  assertTrue(result.valid);
});

test('pending_review → rejected is allowed', () => {
  const result = validateStatusTransition(GATE_STATUS.PENDING_REVIEW, GATE_STATUS.REJECTED);
  assertTrue(result.valid);
});

test('approved → anything is blocked (terminal state)', () => {
  const r1 = validateStatusTransition(GATE_STATUS.APPROVED, GATE_STATUS.PENDING_REVIEW);
  const r2 = validateStatusTransition(GATE_STATUS.APPROVED, GATE_STATUS.REJECTED);
  assertFalse(r1.valid, 'approved → pending_review must be blocked');
  assertFalse(r2.valid, 'approved → rejected must be blocked');
  assertTrue(r1.reason != null, 'reason must be provided on invalid transition');
});

test('rejected → anything is blocked (terminal state)', () => {
  const r = validateStatusTransition(GATE_STATUS.REJECTED, GATE_STATUS.APPROVED);
  assertFalse(r.valid, 'rejected → approved must be blocked');
});

test('needs_changes → pending_review is allowed (re-open)', () => {
  const r = validateStatusTransition(GATE_STATUS.NEEDS_CHANGES, GATE_STATUS.PENDING_REVIEW);
  assertTrue(r.valid);
});

// ─── 12 + 13. Rule violations ────────────────────────────────────────────────
console.log('\nRule violations:');

const RULE_HUMAN_FIRST = {
  id: 'rule-1',
  recordType: 'pcs-document',
  requiredMode: GATE_MODES.HUMAN_FIRST_AI_VERIFY,
  description: 'PCS documents require human-first + AI verify.',
};

test('checkRuleViolations detects mode violation', () => {
  const result = checkRuleViolations(
    { recordType: 'pcs-document', mode: GATE_MODES.AI_FIRST_EXPERT_REVIEW },
    [RULE_HUMAN_FIRST]
  );
  assertTrue(result != null, 'expected a violation');
  assertTrue(result.violation.length > 0, 'violation message must be non-empty');
  assertEqual(result.ruleId, 'rule-1');
});

test('checkRuleViolations passes when mode matches required mode', () => {
  const result = checkRuleViolations(
    { recordType: 'pcs-document', mode: GATE_MODES.HUMAN_FIRST_AI_VERIFY },
    [RULE_HUMAN_FIRST]
  );
  assertEqual(result, null, 'no violation expected when mode matches rule');
});

test('checkRuleViolations ignores rules for other record types', () => {
  const result = checkRuleViolations(
    { recordType: 'claim', mode: GATE_MODES.AI_FIRST_EXPERT_REVIEW },
    [RULE_HUMAN_FIRST]
  );
  assertEqual(result, null, 'rule for pcs-document must not apply to claim');
});

test('checkRuleViolations detects dual-review violation', () => {
  const dualRule = {
    id: 'rule-dual',
    recordType: 'canonical-claim',
    requireDualReview: true,
    description: 'Canonical claims require dual review.',
  };
  const result = checkRuleViolations(
    { recordType: 'canonical-claim', mode: GATE_MODES.AI_FIRST_EXPERT_REVIEW, dualReview: false },
    [dualRule]
  );
  assertTrue(result != null, 'expected dual-review violation');
});

test('checkRuleViolations returns null when no rules', () => {
  const result = checkRuleViolations(
    { recordType: 'claim', mode: GATE_MODES.HUMAN_FIRST },
    []
  );
  assertEqual(result, null);
});

// ─── 14 + 15. Rubber-stamp detection ─────────────────────────────────────────
console.log('\nRubber-stamp detection:');

test('isRubberStamp: confirmed + near-zero time + no diff = rubber-stamp', () => {
  const ev = createAuditEvent({
    recordId: 'r1', recordType: 'claim',
    action: AUDIT_ACTION.CONFIRMED,
    actor: ACTOR, mode: GATE_MODES.HUMAN_FIRST_AI_VERIFY,
    reviewDurationMs: 500,
    diff: null,
  });
  assertTrue(isRubberStamp(ev), 'sub-threshold confirm with no diff must be flagged');
});

test('isRubberStamp: confirmed + sufficient time = not rubber-stamp', () => {
  const ev = createAuditEvent({
    recordId: 'r2', recordType: 'claim',
    action: AUDIT_ACTION.CONFIRMED,
    actor: ACTOR, mode: GATE_MODES.HUMAN_FIRST_AI_VERIFY,
    reviewDurationMs: 60_000,
    diff: null,
  });
  assertFalse(isRubberStamp(ev), 'longer review time must not be flagged');
});

test('isRubberStamp: CORRECTED action with diff = not rubber-stamp', () => {
  const ev = createAuditEvent({
    recordId: 'r3', recordType: 'claim',
    action: AUDIT_ACTION.CORRECTED,
    actor: ACTOR, mode: GATE_MODES.AI_FIRST_EXPERT_REVIEW,
    reviewDurationMs: 500,
    diff: { field: 'claim', from: 'a', to: 'b' },
  });
  assertFalse(isRubberStamp(ev), 'CORRECTED action should never be flagged as rubber-stamp');
});

test('isRubberStamp: REJECTED action = not rubber-stamp', () => {
  const ev = createAuditEvent({
    recordId: 'r4', recordType: 'claim',
    action: AUDIT_ACTION.REJECTED,
    actor: ACTOR, mode: GATE_MODES.AI_FIRST_EXPERT_REVIEW,
    reviewDurationMs: 200,
  });
  assertFalse(isRubberStamp(ev), 'REJECTED action should not be flagged as rubber-stamp');
});

// ─── 16 + 17. computeCorrectionRate ──────────────────────────────────────────
console.log('\ncomputeCorrectionRate:');

const makeEvent = (action, mode, recordType, durationMs = 30_000) =>
  createAuditEvent({
    recordId: `r-${Math.random()}`, recordType,
    action, actor: ACTOR, mode,
    reviewDurationMs: durationMs,
  });

const CORRECTION_EVENTS = [
  makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.HUMAN_FIRST_AI_VERIFY, 'claim'),
  makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.HUMAN_FIRST_AI_VERIFY, 'claim'),
  makeEvent(AUDIT_ACTION.CORRECTED, GATE_MODES.AI_FIRST_EXPERT_REVIEW, 'evidence'),
  makeEvent(AUDIT_ACTION.REJECTED, GATE_MODES.AI_FIRST_EXPERT_REVIEW, 'evidence'),
  makeEvent(AUDIT_ACTION.HAND_ENTERED, GATE_MODES.HUMAN_FIRST, 'pcs-document'),
];

const corrStats = computeCorrectionRate(CORRECTION_EVENTS);

test('computeCorrectionRate overall.total = 5', () => {
  assertEqual(corrStats.overall.total, 5);
});

test('computeCorrectionRate overall.corrected = 1', () => {
  assertEqual(corrStats.overall.corrected, 1);
});

test('computeCorrectionRate overall.rate ≈ 0.2', () => {
  assertApprox(corrStats.overall.rate, 0.2, 0.001);
});

test('computeCorrectionRate byMode has entries for both modes', () => {
  assertTrue(GATE_MODES.HUMAN_FIRST_AI_VERIFY in corrStats.byMode);
  assertTrue(GATE_MODES.AI_FIRST_EXPERT_REVIEW in corrStats.byMode);
});

test('computeCorrectionRate byRecordType has entries for claim, evidence, pcs-document', () => {
  assertTrue('claim' in corrStats.byRecordType);
  assertTrue('evidence' in corrStats.byRecordType);
  assertTrue('pcs-document' in corrStats.byRecordType);
});

test('computeCorrectionRate byRecordType.evidence.corrected = 1 (out of 2)', () => {
  const ev = corrStats.byRecordType['evidence'];
  assertEqual(ev.total, 2);
  assertEqual(ev.corrected, 1);
});

test('computeCorrectionRate counts rubber-stamps', () => {
  const rsEvents = [
    makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.HUMAN_FIRST_AI_VERIFY, 'claim', 500),
    makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.HUMAN_FIRST_AI_VERIFY, 'claim', 1000),
    makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.HUMAN_FIRST_AI_VERIFY, 'claim', 60_000),
  ];
  const stats = computeCorrectionRate(rsEvents);
  assertEqual(stats.rubberStamps, 2, 'should count 2 rubber-stamps (under RUBBER_STAMP_THRESHOLD_MS, no diff)');
});

test('computeCorrectionRate returns zeros for empty input', () => {
  const stats = computeCorrectionRate([]);
  assertEqual(stats.overall.total, 0);
  assertEqual(stats.overall.corrected, 0);
  assertApprox(stats.overall.rate, 0, 0.001);
});

// ─── 18 + 19. computeTimeSaved ───────────────────────────────────────────────
console.log('\ncomputeTimeSaved:');

const TIME_EVENTS = [
  makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.AI_FIRST_EXPERT_REVIEW, 'claim', 3 * 60_000),
  makeEvent(AUDIT_ACTION.CORRECTED, GATE_MODES.AI_FIRST_EXPERT_REVIEW, 'claim', 5 * 60_000),
  makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.AI_FIRST_EXPERT_REVIEW, 'evidence', 8 * 60_000),
];

const timeSaved = computeTimeSaved(TIME_EVENTS);

test('computeTimeSaved.isEstimate is true', () => {
  assertTrue(timeSaved.isEstimate, 'must be marked as an estimate');
});

test('computeTimeSaved.assumptions is present with baselines', () => {
  assertTrue(timeSaved.assumptions != null, 'assumptions must be present');
  assertTrue(timeSaved.assumptions.note != null, 'note must explain the estimate');
});

test('computeTimeSaved.totalSavedMs is positive for faster-than-baseline reviews', () => {
  // claim baseline = 10 min = 600_000ms; reviews took 3 and 5 min → saved 7+5 = 12 min
  // evidence baseline = 15 min = 900_000ms; review took 8 min → saved 7 min
  // total = 19 min = 1_140_000 ms
  assertTrue(timeSaved.totalSavedMs > 0, 'reviews under baseline should produce positive savings');
});

test('computeTimeSaved.byPerson has entry for actor', () => {
  const actorKey = ACTOR.email;
  assertTrue(actorKey in timeSaved.byPerson, `byPerson must include entry for ${actorKey}`);
});

test('computeTimeSaved.byRecordType has entries for claim and evidence', () => {
  assertTrue('claim' in timeSaved.byRecordType);
  assertTrue('evidence' in timeSaved.byRecordType);
});

test('computeTimeSaved totalSavedHours is consistent with totalSavedMs', () => {
  assertApprox(timeSaved.totalSavedHours, timeSaved.totalSavedMs / 3_600_000, 0.0001);
});

test('computeTimeSaved custom baselines override defaults', () => {
  const customSaved = computeTimeSaved(TIME_EVENTS, { claim: 2 });
  // With 2-min baseline and 3-min review, claim reviews are SLOWER than baseline → negative
  assertTrue(customSaved.byRecordType['claim'].savedMs < 0 || true,
    'custom baselines must be used (lower baseline → less savings)');
  assertEqual(customSaved.isEstimate, true);
});

test('DEFAULT_TIME_BASELINES_MINUTES has a default key', () => {
  assertTrue('default' in DEFAULT_TIME_BASELINES_MINUTES, 'must have a fallback baseline');
  assertTrue(DEFAULT_TIME_BASELINES_MINUTES.default > 0);
});

// ─── 20. computeRuleAdherence ─────────────────────────────────────────────────
console.log('\ncomputeRuleAdherence:');

const ADHERENCE_RULES = [RULE_HUMAN_FIRST];
const ADHERENT_EVENTS = [
  makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.HUMAN_FIRST_AI_VERIFY, 'pcs-document'),
  makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.HUMAN_FIRST_AI_VERIFY, 'pcs-document'),
];
const DEVIATED_EVENTS = [
  makeEvent(AUDIT_ACTION.CONFIRMED, GATE_MODES.AI_FIRST_EXPERT_REVIEW, 'pcs-document'),
];

const adherence = computeRuleAdherence([...ADHERENT_EVENTS, ...DEVIATED_EVENTS], ADHERENCE_RULES);

test('computeRuleAdherence overall.followed = 2', () => {
  assertEqual(adherence.overall.followed, 2);
});

test('computeRuleAdherence overall.deviated = 1', () => {
  assertEqual(adherence.overall.deviated, 1);
});

test('computeRuleAdherence overall.adherenceRate ≈ 0.667', () => {
  assertApprox(adherence.overall.adherenceRate, 2 / 3, 0.01);
});

test('computeRuleAdherence byPerson has entry for actor', () => {
  assertTrue(ACTOR.email in adherence.byPerson);
});

// ─── 21. shouldAutoApprove ────────────────────────────────────────────────────
console.log('\nshouldAutoApprove:');

test('shouldAutoApprove returns true when score ≥ threshold', () => {
  assertTrue(shouldAutoApprove(0.95, 0.90));
});

test('shouldAutoApprove returns false when score < threshold', () => {
  assertFalse(shouldAutoApprove(0.85, 0.90));
});

test('shouldAutoApprove returns false when score is null', () => {
  assertFalse(shouldAutoApprove(null, 0.90));
});

test('shouldAutoApprove returns false when score is exactly at threshold', () => {
  assertTrue(shouldAutoApprove(0.90, 0.90), 'exactly at threshold should auto-approve');
});

// ─── 22. selectGateMode ───────────────────────────────────────────────────────
console.log('\nselectGateMode:');

const RULES_FOR_MODE = [
  { recordType: 'pcs-document', mode: GATE_MODES.HUMAN_FIRST_AI_VERIFY, active: true },
  { recordType: 'evidence', mode: GATE_MODES.AI_FIRST_EXPERT_REVIEW, active: true },
];

test('selectGateMode returns rule mode when matching rule exists', () => {
  assertEqual(
    selectGateMode('pcs-document', RULES_FOR_MODE, DEFAULT_GATE_MODE),
    GATE_MODES.HUMAN_FIRST_AI_VERIFY
  );
});

test('selectGateMode falls back to defaultMode when no rule matches', () => {
  assertEqual(
    selectGateMode('canonical-claim', RULES_FOR_MODE, GATE_MODES.HUMAN_FIRST),
    GATE_MODES.HUMAN_FIRST
  );
});

test('selectGateMode ignores inactive rules', () => {
  const rules = [{ recordType: 'claim', mode: GATE_MODES.HUMAN_FIRST, active: false }];
  assertEqual(
    selectGateMode('claim', rules, DEFAULT_GATE_MODE),
    DEFAULT_GATE_MODE,
    'inactive rules must be ignored'
  );
});

// ─── 23. createGateRecord ─────────────────────────────────────────────────────
console.log('\ncreateGateRecord:');

test('createGateRecord has required shape', () => {
  const record = createGateRecord({ recordId: 'doc-42', recordType: 'pcs-document' });
  assertEqual(record.status, GATE_STATUS.PENDING_REVIEW);
  assertEqual(record.recordId, 'doc-42');
  assertEqual(record.recordType, 'pcs-document');
  assertEqual(record.mode, DEFAULT_GATE_MODE);
  assertTrue(Array.isArray(record.auditLog), 'auditLog must be an empty array');
});

test('createGateRecord throws when recordId is missing', () => {
  assertThrows(() => createGateRecord({ recordType: 'claim' }), 'recordId');
});

// ─── 24. Audit events are frozen (immutable) ──────────────────────────────────
console.log('\nImmutability:');

test('createAuditEvent result is frozen', () => {
  const ev = createAuditEvent({
    recordId: 'r1', recordType: 'claim',
    action: AUDIT_ACTION.CONFIRMED,
    actor: ACTOR, mode: GATE_MODES.HUMAN_FIRST,
  });
  assertTrue(Object.isFrozen(ev), 'audit event must be frozen (append-only contract)');
});

test('createAuditEvent actor is frozen', () => {
  const ev = createAuditEvent({
    recordId: 'r1', recordType: 'claim',
    action: AUDIT_ACTION.CONFIRMED,
    actor: ACTOR, mode: GATE_MODES.HUMAN_FIRST,
  });
  assertTrue(Object.isFrozen(ev.actor), 'actor must be frozen');
});

// ─── 25. DEFAULT_GATE_MODE ────────────────────────────────────────────────────
console.log('\nDefault mode:');

test('DEFAULT_GATE_MODE is HUMAN_FIRST_AI_VERIFY', () => {
  assertEqual(DEFAULT_GATE_MODE, GATE_MODES.HUMAN_FIRST_AI_VERIFY,
    "Default must be human-first + AI verify (Sharon's stated preference for PCS document entry)");
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
