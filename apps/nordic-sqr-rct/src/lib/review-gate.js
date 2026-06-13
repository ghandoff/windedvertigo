/**
 * Expert-in-the-loop review gate — shared, platform-wide.
 *
 * Pure logic module (no I/O). Callers (API routes) handle persistence.
 * Import and reuse from: PCS extraction, claim standardization, evidence
 * extraction, dossier generation, and any future gate.
 *
 * Usage pattern in an API route:
 *
 *   const gate = await requireCapability(request, 'pcs.review:approve');
 *   if (gate.error) return gate.error;
 *   if (!canApprove(gate.user)) return 403;
 *   const event = createAuditEvent({ actor: gate.user, action: AUDIT_ACTION.CONFIRMED, ... });
 *   // Persist event to your store, then return updated status.
 *
 * Spec: docs/expert-in-the-loop-gates-build-prompt.md
 */

import { can } from './auth/capabilities.js';

// ─── Mode constants ──────────────────────────────────────────────────────────

/**
 * Configurable gate modes. Set per record type via the rules engine (§5.2).
 * Each step / record type can run a different mode — not hard-wired.
 */
export const GATE_MODES = Object.freeze({
  /** Expert reads and enters by hand. No AI involvement. */
  HUMAN_FIRST: 'human-first',
  /**
   * Expert enters first, then AI runs an alignment/QA pass and flags
   * discrepancies for the expert to resolve. DEFAULT for PCS document entry
   * (Sharon's preference: person reads + enters every article, AI checks after).
   */
  HUMAN_FIRST_AI_VERIFY: 'human-first-ai-verify',
  /** Automation extracts; expert confirms or corrects. */
  AI_FIRST_EXPERT_REVIEW: 'ai-first-expert-review',
  /**
   * High-confidence items auto-approve with spot-checks.
   * Items below confidence threshold T route to expert review.
   */
  AI_AUTO_ABOVE_CONFIDENCE: 'ai-auto-above-confidence',
});

export const DEFAULT_GATE_MODE = GATE_MODES.HUMAN_FIRST_AI_VERIFY;

// ─── Status lifecycle ────────────────────────────────────────────────────────

/**
 * Review status for any AI/automation-produced record.
 * Non-approved records are non-authoritative (§2).
 */
export const GATE_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  NEEDS_CHANGES: 'needs_changes',
  REJECTED: 'rejected',
});

// ─── Audit action types ──────────────────────────────────────────────────────

/**
 * Distinguishes what the expert actually did. Critical for rubber-stamp detection
 * and proving a human meaningfully touched the record (§5.1).
 *
 * - CONFIRMED: opened, reviewed, and approved without changes
 * - CORRECTED: opened, changed something (diff present), and approved
 * - REJECTED: rejected; record stays non-authoritative
 * - HAND_ENTERED: expert entered the record from scratch (human-first mode)
 * - REQUESTED_CHANGES: returned to author with notes; status → needs_changes
 * - AI_VERIFIED: AI alignment pass ran and found no discrepancies (human-first-ai-verify mode)
 * - AI_FLAGGED: AI alignment pass found a discrepancy; routed back to expert
 * - AUTO_APPROVED: AI-auto mode approved above confidence threshold T
 */
export const AUDIT_ACTION = Object.freeze({
  CONFIRMED: 'confirmed',
  CORRECTED: 'corrected',
  REJECTED: 'rejected',
  HAND_ENTERED: 'hand_entered',
  REQUESTED_CHANGES: 'requested_changes',
  AI_VERIFIED: 'ai_verified',
  AI_FLAGGED: 'ai_flagged',
  AUTO_APPROVED: 'auto_approved',
});

// ─── Expert roles ────────────────────────────────────────────────────────────

/**
 * Roles permitted to approve/reject. pcs-readonly and reviewer are excluded.
 * Enforced server-side via requireCapability('pcs.review:approve').
 */
export const EXPERT_ROLES = Object.freeze(['researcher', 'ra', 'admin', 'super-user']);

// ─── Governance defaults ─────────────────────────────────────────────────────

/**
 * Governance layer configuration. Ships with governanceEnabled: false.
 * Only a super-user can flip governanceEnabled to true (pcs.governance:manage).
 *
 * captureHistoryWhenOff: true (recommended default) — keeps the audit log
 * growing even while governance is OFF, so the eventual go-live demo has
 * real data to show and the audit trail is continuous.
 */
export const DEFAULT_GOVERNANCE_CONFIG = Object.freeze({
  governanceEnabled: false,
  captureHistoryWhenOff: true,
  autoApproveConfidenceThreshold: 0.90,
  defaultMode: GATE_MODES.HUMAN_FIRST_AI_VERIFY,
});

/**
 * Baseline manual-entry minutes per record type. Used for time-saved estimates.
 * These are explicit, configurable assumptions — shown to users as estimates,
 * never as hard claims. Sharon's team should tune these with real data.
 */
export const DEFAULT_TIME_BASELINES_MINUTES = Object.freeze({
  'pcs-document': 45,
  'claim': 10,
  'evidence': 15,
  'canonical-claim': 8,
  'dossier': 30,
  default: 20,
});

/**
 * Rubber-stamp detection: review duration below this threshold (ms) with no
 * diff on a CONFIRMED action is flagged as a potential rubber-stamp.
 */
export const RUBBER_STAMP_THRESHOLD_MS = 8_000;

// ─── Valid status transitions ────────────────────────────────────────────────

/**
 * Which transitions are allowed from a given current status.
 * Immutable directed graph; callers must validate before persisting.
 */
const VALID_TRANSITIONS = Object.freeze({
  [GATE_STATUS.PENDING_REVIEW]: new Set([
    GATE_STATUS.APPROVED,
    GATE_STATUS.NEEDS_CHANGES,
    GATE_STATUS.REJECTED,
  ]),
  [GATE_STATUS.NEEDS_CHANGES]: new Set([
    GATE_STATUS.PENDING_REVIEW,
    GATE_STATUS.APPROVED,
    GATE_STATUS.REJECTED,
  ]),
  // Terminal states — no further transitions allowed
  [GATE_STATUS.APPROVED]: new Set(),
  [GATE_STATUS.REJECTED]: new Set(),
});

// ─── Access guards ──────────────────────────────────────────────────────────

/**
 * True if the user holds the `pcs.review:approve` capability.
 * Server routes MUST also call requireCapability('pcs.review:approve') for
 * hard enforcement — this helper is for UI gating only.
 */
export function canApprove(user) {
  return can(user, 'pcs.review:approve');
}

/**
 * True if the user can define/edit gate rules (admin or RA).
 */
export function canEditRules(user) {
  return can(user, 'pcs.review.rules:edit');
}

/**
 * True if the user can toggle the governance layer ON/OFF (super-user only).
 */
export function canManageGovernance(user) {
  return can(user, 'pcs.governance:manage');
}

/**
 * Returns true if the governance layer is currently active.
 * When OFF: gates still function and history is captured (if captureHistoryWhenOff).
 * When ON: rules enforce, dashboards and metrics appear.
 *
 * @param {{ governanceEnabled?: boolean, captureHistoryWhenOff?: boolean }} config
 */
export function isGovernanceEnabled(config = {}) {
  return Boolean(config?.governanceEnabled);
}

/**
 * Returns true if audit events should be captured in the current config state.
 * True when governance is ON, or when governance is OFF but captureHistoryWhenOff is true.
 */
export function shouldCaptureHistory(config = {}) {
  if (isGovernanceEnabled(config)) return true;
  return config?.captureHistoryWhenOff !== false;
}

// ─── Status lifecycle ────────────────────────────────────────────────────────

/**
 * Map an AUDIT_ACTION to the resulting GATE_STATUS transition.
 * Returns null if the action does not trigger a status change.
 */
export function actionToStatus(action) {
  const map = {
    [AUDIT_ACTION.CONFIRMED]: GATE_STATUS.APPROVED,
    [AUDIT_ACTION.CORRECTED]: GATE_STATUS.APPROVED,
    [AUDIT_ACTION.HAND_ENTERED]: GATE_STATUS.APPROVED,
    [AUDIT_ACTION.AUTO_APPROVED]: GATE_STATUS.APPROVED,
    [AUDIT_ACTION.REJECTED]: GATE_STATUS.REJECTED,
    [AUDIT_ACTION.REQUESTED_CHANGES]: GATE_STATUS.NEEDS_CHANGES,
    [AUDIT_ACTION.AI_FLAGGED]: GATE_STATUS.NEEDS_CHANGES,
    [AUDIT_ACTION.AI_VERIFIED]: null,
  };
  return map[action] ?? null;
}

/**
 * Validates whether a status transition is allowed.
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateStatusTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) {
    return { valid: false, reason: `Unknown current status: ${currentStatus}` };
  }
  if (nextStatus === currentStatus) {
    return { valid: true };
  }
  if (!allowed.has(nextStatus)) {
    return {
      valid: false,
      reason: `Cannot transition from ${currentStatus} to ${nextStatus}`,
    };
  }
  return { valid: true };
}

// ─── Audit log ───────────────────────────────────────────────────────────────

/**
 * Creates an immutable audit event row. This is the append-only record of a
 * human (or automated) touch on a gate item. Do not mutate after creation.
 *
 * Frozen so the caller cannot accidentally modify it before persisting.
 *
 * @param {{
 *   recordId: string,
 *   recordType: string,       // 'pcs-document' | 'claim' | 'evidence' | 'canonical-claim' | 'dossier'
 *   action: string,           // AUDIT_ACTION.*
 *   actor: { id: string, email: string, name?: string, roles: string[] },
 *   automationSuggestion?: object,  // snapshot of what the AI/automation produced
 *   expertValue?: object,           // what the expert submitted (may differ from suggestion)
 *   diff?: object,                  // structured diff if CORRECTED (null for CONFIRMED)
 *   reviewDurationMs?: number,      // how long the expert had the record open
 *   confidenceScore?: number,       // 0–1, from the automation's output
 *   mode: string,                   // GATE_MODES.* that was active for this record
 *   notes?: string,
 *   ruleId?: string,                // which gate rule applied, if any
 * }} opts
 * @returns {object} immutable audit row
 */
export function createAuditEvent(opts) {
  const {
    recordId,
    recordType,
    action,
    actor,
    automationSuggestion = null,
    expertValue = null,
    diff = null,
    reviewDurationMs = null,
    confidenceScore = null,
    mode,
    notes = null,
    ruleId = null,
  } = opts;

  if (!recordId) throw new Error('createAuditEvent: recordId is required');
  if (!recordType) throw new Error('createAuditEvent: recordType is required');
  if (!action || !Object.values(AUDIT_ACTION).includes(action)) {
    throw new Error(`createAuditEvent: invalid action "${action}"`);
  }
  if (!actor?.id) throw new Error('createAuditEvent: actor.id is required');
  if (!mode || !Object.values(GATE_MODES).includes(mode)) {
    throw new Error(`createAuditEvent: invalid mode "${mode}"`);
  }

  return Object.freeze({
    id: `audit_${recordId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    recordId,
    recordType,
    action,
    actor: Object.freeze({
      id: actor.id,
      email: actor.email,
      name: actor.name ?? null,
      roles: Object.freeze([...(actor.roles ?? [])]),
    }),
    automationSuggestion,
    expertValue,
    diff,
    reviewDurationMs,
    confidenceScore,
    mode,
    notes,
    ruleId,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Creates the initial gate record for a new item entering the review pipeline.
 * Callers persist this and update it as review progresses.
 *
 * @param {{
 *   recordId: string,
 *   recordType: string,
 *   mode?: string,            // defaults to DEFAULT_GATE_MODE
 *   confidenceScore?: number,
 *   automationSuggestion?: object,
 * }} opts
 * @returns {{ recordId, recordType, status, mode, confidenceScore, createdAt, auditLog: [] }}
 */
export function createGateRecord(opts) {
  const {
    recordId,
    recordType,
    mode = DEFAULT_GATE_MODE,
    confidenceScore = null,
    automationSuggestion = null,
  } = opts;

  if (!recordId) throw new Error('createGateRecord: recordId is required');
  if (!recordType) throw new Error('createGateRecord: recordType is required');

  return {
    recordId,
    recordType,
    status: GATE_STATUS.PENDING_REVIEW,
    mode,
    confidenceScore,
    automationSuggestion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    auditLog: [],
  };
}

// ─── Rules engine ────────────────────────────────────────────────────────────

/**
 * Checks whether a given record type should auto-approve based on confidence.
 * Only applies when mode is AI_AUTO_ABOVE_CONFIDENCE.
 *
 * @param {number|null} confidenceScore
 * @param {number} threshold  (0–1; from governance config or rule override)
 * @returns {boolean}
 */
export function shouldAutoApprove(confidenceScore, threshold) {
  if (confidenceScore == null) return false;
  return confidenceScore >= threshold;
}

/**
 * Given a record type and the current set of gate rules, determine which mode
 * applies. Falls back to defaultMode if no matching rule.
 *
 * @param {string} recordType
 * @param {Array<{ recordType: string, mode: string, ... }>} rules
 * @param {string} defaultMode
 * @returns {string} a GATE_MODES value
 */
export function selectGateMode(recordType, rules = [], defaultMode = DEFAULT_GATE_MODE) {
  const match = rules.find((r) => r.recordType === recordType && r.active !== false);
  return match?.mode ?? defaultMode;
}

/**
 * Validates a record action against a gate rule. Returns whether it's allowed
 * and the violation message if not.
 *
 * @param {{
 *   recordType: string,
 *   mode: string,           // the mode being used
 *   dualReview?: boolean,   // whether dual review has been satisfied
 * }} record
 * @param {{
 *   recordType: string,
 *   requiredMode?: string,
 *   requireDualReview?: boolean,
 *   minConfidenceForAutoApprove?: number,
 *   blockAutoApproveBelow?: number,
 *   description?: string,
 * }} rule
 * @returns {{ allowed: boolean, violation?: string }}
 */
export function applyRule(record, rule) {
  if (rule.recordType && rule.recordType !== record.recordType) {
    return { allowed: true };
  }

  if (rule.requiredMode && record.mode !== rule.requiredMode) {
    return {
      allowed: false,
      violation: `Rule requires mode "${rule.requiredMode}" for ${record.recordType}, but mode "${record.mode}" was used. ${rule.description ?? ''}`.trim(),
    };
  }

  if (rule.requireDualReview && !record.dualReview) {
    return {
      allowed: false,
      violation: `Rule requires dual review for ${record.recordType}. A second reviewer must approve before this record is authoritative. ${rule.description ?? ''}`.trim(),
    };
  }

  return { allowed: true };
}

/**
 * Validates that a proposed action satisfies all applicable rules. Stops at
 * the first violation. Returns the first violation found, or null if all pass.
 *
 * @param {object} record
 * @param {object[]} rules
 * @returns {{ violation: string, ruleId?: string } | null}
 */
export function checkRuleViolations(record, rules = []) {
  for (const rule of rules) {
    const result = applyRule(record, rule);
    if (!result.allowed) {
      return { violation: result.violation, ruleId: rule.id };
    }
  }
  return null;
}

// ─── Rubber-stamp detection ──────────────────────────────────────────────────

/**
 * Returns true if this audit event looks like a rubber-stamp: the expert
 * confirmed without changes and spent very little time reviewing.
 * Rubber-stamps are made visible in the management dashboard, not hidden.
 *
 * @param {{ action: string, reviewDurationMs: number|null, diff: object|null }} auditEvent
 * @param {{ rubberStampThresholdMs?: number }} opts
 * @returns {boolean}
 */
export function isRubberStamp(auditEvent, opts = {}) {
  const threshold = opts.rubberStampThresholdMs ?? RUBBER_STAMP_THRESHOLD_MS;
  if (auditEvent.action !== AUDIT_ACTION.CONFIRMED) return false;
  if (auditEvent.diff != null) return false;
  if (auditEvent.reviewDurationMs == null) return false;
  return auditEvent.reviewDurationMs < threshold;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

/**
 * Computes correction rate per gate type / mode / record type.
 * "Correction" = CORRECTED action (expert changed the automation's output).
 *
 * High correction rate → human review adds a lot of value here; keep gate tight.
 * Low correction rate → automation is trustworthy; consider raising auto-approve T.
 *
 * @param {object[]} auditEvents  array of audit event rows
 * @returns {{
 *   overall: { total: number, corrected: number, rate: number },
 *   byMode: Record<string, { total: number, corrected: number, rate: number }>,
 *   byRecordType: Record<string, { total: number, corrected: number, rate: number }>,
 *   rubberStamps: number,
 * }}
 */
export function computeCorrectionRate(auditEvents = []) {
  const expertActions = new Set([
    AUDIT_ACTION.CONFIRMED,
    AUDIT_ACTION.CORRECTED,
    AUDIT_ACTION.REJECTED,
    AUDIT_ACTION.HAND_ENTERED,
  ]);

  const reviewedEvents = auditEvents.filter((e) => expertActions.has(e.action));

  function tally(events) {
    const total = events.length;
    const corrected = events.filter((e) => e.action === AUDIT_ACTION.CORRECTED).length;
    return { total, corrected, rate: total > 0 ? corrected / total : 0 };
  }

  const byMode = {};
  const byRecordType = {};

  for (const event of reviewedEvents) {
    if (event.mode) {
      byMode[event.mode] = byMode[event.mode] ?? [];
      byMode[event.mode].push(event);
    }
    if (event.recordType) {
      byRecordType[event.recordType] = byRecordType[event.recordType] ?? [];
      byRecordType[event.recordType].push(event);
    }
  }

  return {
    overall: tally(reviewedEvents),
    byMode: Object.fromEntries(Object.entries(byMode).map(([k, v]) => [k, tally(v)])),
    byRecordType: Object.fromEntries(Object.entries(byRecordType).map(([k, v]) => [k, tally(v)])),
    rubberStamps: reviewedEvents.filter(isRubberStamp).length,
  };
}

/**
 * Estimates time saved by reviewing vs. entering by hand.
 *
 * Formula per event:
 *   savedMs = (baselineMinutes * 60_000) − reviewDurationMs
 *
 * Negative means the review took longer than a hand-entry would have (unusual).
 * Results are grouped by person and record type, and summed.
 *
 * Assumptions are explicit and configurable; the return value always includes
 * the assumptions used so the UI can show "estimate based on: ..." rather than
 * presenting the number as a hard fact.
 *
 * @param {object[]} auditEvents
 * @param {Record<string, number>} baselineMinutes  per-record-type manual entry time
 * @returns {{
 *   totalSavedMs: number,
 *   totalSavedHours: number,
 *   byPerson: Record<string, { savedMs: number, eventCount: number }>,
 *   byRecordType: Record<string, { savedMs: number, eventCount: number }>,
 *   assumptions: object,
 *   isEstimate: true,
 * }}
 */
export function computeTimeSaved(auditEvents = [], baselineMinutes = {}) {
  const baselines = { ...DEFAULT_TIME_BASELINES_MINUTES, ...baselineMinutes };
  const reviewActions = new Set([
    AUDIT_ACTION.CONFIRMED,
    AUDIT_ACTION.CORRECTED,
    AUDIT_ACTION.REJECTED,
  ]);

  const reviewEvents = auditEvents.filter(
    (e) => reviewActions.has(e.action) && e.reviewDurationMs != null
  );

  let totalSavedMs = 0;
  const byPerson = {};
  const byRecordType = {};

  for (const event of reviewEvents) {
    const baselineMins = baselines[event.recordType] ?? baselines.default;
    const baselineMs = baselineMins * 60_000;
    const savedMs = baselineMs - event.reviewDurationMs;

    totalSavedMs += savedMs;

    const actorKey = event.actor?.email ?? event.actor?.id ?? 'unknown';
    byPerson[actorKey] = byPerson[actorKey] ?? { savedMs: 0, eventCount: 0 };
    byPerson[actorKey].savedMs += savedMs;
    byPerson[actorKey].eventCount += 1;

    const typeKey = event.recordType ?? 'unknown';
    byRecordType[typeKey] = byRecordType[typeKey] ?? { savedMs: 0, eventCount: 0 };
    byRecordType[typeKey].savedMs += savedMs;
    byRecordType[typeKey].eventCount += 1;
  }

  return {
    totalSavedMs,
    totalSavedHours: totalSavedMs / 3_600_000,
    byPerson,
    byRecordType,
    assumptions: {
      baselines: { ...baselines },
      note: 'Estimate: (baseline manual-entry minutes) − (actual review minutes) per record. Baselines are configurable assumptions, not measured data.',
    },
    isEstimate: true,
  };
}

/**
 * Aggregates rule adherence by person and team for the management dashboard.
 * Counts how many reviews followed the required mode vs. deviated.
 *
 * @param {object[]} auditEvents
 * @param {object[]} rules
 * @returns {{
 *   byPerson: Record<string, { followed: number, deviated: number, rubberStamps: number }>,
 *   overall: { followed: number, deviated: number, adherenceRate: number },
 * }}
 */
export function computeRuleAdherence(auditEvents = [], rules = []) {
  const byPerson = {};

  for (const event of auditEvents) {
    const key = event.actor?.email ?? event.actor?.id ?? 'unknown';
    byPerson[key] = byPerson[key] ?? { followed: 0, deviated: 0, rubberStamps: 0 };

    const ruleResult = checkRuleViolations(
      { recordType: event.recordType, mode: event.mode },
      rules
    );

    if (ruleResult) {
      byPerson[key].deviated += 1;
    } else {
      byPerson[key].followed += 1;
    }

    if (isRubberStamp(event)) {
      byPerson[key].rubberStamps += 1;
    }
  }

  const totals = Object.values(byPerson).reduce(
    (acc, p) => {
      acc.followed += p.followed;
      acc.deviated += p.deviated;
      return acc;
    },
    { followed: 0, deviated: 0 }
  );

  const total = totals.followed + totals.deviated;
  return {
    byPerson,
    overall: {
      ...totals,
      adherenceRate: total > 0 ? totals.followed / total : 1,
    },
  };
}
