/**
 * POST /api/pcs/review
 *
 * Submit a review action (approve, correct, reject, request-changes) on any
 * gate-eligible record. Platform-wide: used by PCS extraction, claim
 * standardization, evidence extraction, and dossier sign-off.
 *
 * Request body:
 *   {
 *     recordId: string,
 *     recordType: 'pcs-document' | 'claim' | 'evidence' | 'canonical-claim' | 'dossier',
 *     action: AUDIT_ACTION.*,
 *     diff?: object,             // present when action=corrected
 *     expertValue?: object,      // the value the expert submitted
 *     reviewDurationMs?: number, // ms the expert had the item open
 *     confidenceScore?: number,
 *     mode?: string,             // GATE_MODES.* — defaults to DEFAULT_GATE_MODE
 *     notes?: string,
 *     ruleId?: string,
 *     currentStatus?: string,    // GATE_STATUS.* — for transition validation
 *   }
 *
 * Returns: { auditEvent, newStatus, isRubberStamp }
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability.js';
import {
  AUDIT_ACTION,
  GATE_MODES,
  DEFAULT_GATE_MODE,
  createAuditEvent,
  actionToStatus,
  validateStatusTransition,
  canApprove,
  isRubberStamp,
  shouldCaptureHistory,
  GATE_STATUS,
} from '@/lib/review-gate.js';
import { appendReviewEvent, getGovernanceConfig } from '@/lib/pcs-review-events.js';

export async function POST(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'POST /api/pcs/review',
  });
  if (gate.error) return gate.error;
  const { user } = gate;

  if (!canApprove(user)) {
    return NextResponse.json(
      { error: 'missing-capability', required: 'pcs.review:approve' },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const {
    recordId,
    recordType,
    action,
    diff = null,
    expertValue = null,
    reviewDurationMs = null,
    confidenceScore = null,
    mode = DEFAULT_GATE_MODE,
    notes = null,
    ruleId = null,
    currentStatus = GATE_STATUS.PENDING_REVIEW,
  } = body;

  if (!recordId || !recordType || !action) {
    return NextResponse.json(
      { error: 'missing-fields', required: ['recordId', 'recordType', 'action'] },
      { status: 400 }
    );
  }

  if (!Object.values(AUDIT_ACTION).includes(action)) {
    return NextResponse.json(
      { error: 'invalid-action', validActions: Object.values(AUDIT_ACTION) },
      { status: 400 }
    );
  }

  if (!Object.values(GATE_MODES).includes(mode)) {
    return NextResponse.json(
      { error: 'invalid-mode', validModes: Object.values(GATE_MODES) },
      { status: 400 }
    );
  }

  const newStatus = actionToStatus(action);
  if (newStatus) {
    const transition = validateStatusTransition(currentStatus, newStatus);
    if (!transition.valid) {
      return NextResponse.json(
        { error: 'invalid-transition', reason: transition.reason },
        { status: 422 }
      );
    }
  }

  let auditEvent;
  try {
    auditEvent = createAuditEvent({
      recordId,
      recordType,
      action,
      actor: {
        id: user.reviewerId ?? user.id ?? user.email,
        email: user.email,
        name: user.name,
        roles: user.roles ?? [],
      },
      diff,
      expertValue,
      reviewDurationMs,
      confidenceScore,
      mode,
      notes,
      ruleId,
    });
  } catch (err) {
    return NextResponse.json({ error: 'audit-event-error', message: err.message }, { status: 400 });
  }

  // Persist to Supabase if governance config says we should.
  const governanceConfig = await getGovernanceConfig();
  if (shouldCaptureHistory(governanceConfig)) {
    try {
      await appendReviewEvent(auditEvent);
    } catch (err) {
      // Non-fatal: the response is still successful even if persistence fails.
      // The caller gets the audit event object and can retry.
      console.warn(`[review-gate] appendReviewEvent failed: ${err.message}`);
    }
  }

  const rubberStamp = isRubberStamp(auditEvent);

  return NextResponse.json({
    auditEvent,
    newStatus: newStatus ?? currentStatus,
    isRubberStamp: rubberStamp,
  });
}
