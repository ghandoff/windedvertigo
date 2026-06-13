/**
 * GET  /api/pcs/governance/rules  — list all gate rules
 * POST /api/pcs/governance/rules  — create a new gate rule (admin/RA)
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability.js';
import { GATE_MODES } from '@/lib/review-gate.js';
import { getGovernanceRules, createGovernanceRule } from '@/lib/pcs-review-events.js';

export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'GET /api/pcs/governance/rules',
  });
  if (gate.error) return gate.error;

  const rules = await getGovernanceRules({ includeInactive: true });
  return NextResponse.json({ rules });
}

export async function POST(request) {
  const gate = await requireCapability(request, 'pcs.review.rules:edit', {
    route: 'POST /api/pcs/governance/rules',
  });
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (!body.recordType || !body.description) {
    return NextResponse.json(
      { error: 'missing-fields', required: ['recordType', 'description'] },
      { status: 400 }
    );
  }

  if (body.requiredMode && !Object.values(GATE_MODES).includes(body.requiredMode)) {
    return NextResponse.json(
      { error: 'invalid-mode', validModes: Object.values(GATE_MODES) },
      { status: 400 }
    );
  }

  try {
    const rule = await createGovernanceRule({
      recordType: body.recordType,
      requiredMode: body.requiredMode ?? null,
      requireDualReview: body.requireDualReview ?? false,
      minConfidenceForAutoApprove: body.minConfidenceForAutoApprove ?? null,
      blockAutoApproveBelow: body.blockAutoApproveBelow ?? null,
      description: body.description,
      active: body.active !== false,
      createdBy: gate.user.email,
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'create-failed', message: err.message }, { status: 500 });
  }
}
