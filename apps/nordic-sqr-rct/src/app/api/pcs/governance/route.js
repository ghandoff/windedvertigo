/**
 * GET  /api/pcs/governance  — returns current governance config + enabled state
 * POST /api/pcs/governance  — super-user toggle governance ON/OFF
 *
 * The governance layer (rule enforcement, dashboards, metrics) ships OFF.
 * Only a super-user can flip it. When OFF: gates still function and review
 * history is still captured (captureHistoryWhenOff: true by default).
 *
 * Body for POST: { governanceEnabled: boolean, captureHistoryWhenOff?: boolean }
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability.js';
import {
  isGovernanceEnabled,
} from '@/lib/review-gate.js';
import { getGovernanceConfig, saveGovernanceConfig } from '@/lib/pcs-review-events.js';

export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'GET /api/pcs/governance',
  });
  if (gate.error) return gate.error;

  const config = await getGovernanceConfig();

  return NextResponse.json({
    ...config,
    isEnabled: isGovernanceEnabled(config),
  });
}

export async function POST(request) {
  const gate = await requireCapability(request, 'pcs.governance:manage', {
    route: 'POST /api/pcs/governance',
  });
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (typeof body.governanceEnabled !== 'boolean') {
    return NextResponse.json(
      { error: 'missing-field', required: 'governanceEnabled (boolean)' },
      { status: 400 }
    );
  }

  try {
    const updated = await saveGovernanceConfig({
      ...body,
      toggledAt: new Date().toISOString(),
      toggledBy: gate.user.email,
    });

    return NextResponse.json({
      ...updated,
      isEnabled: isGovernanceEnabled(updated),
    });
  } catch (err) {
    return NextResponse.json({ error: 'save-failed', message: err.message }, { status: 500 });
  }
}
