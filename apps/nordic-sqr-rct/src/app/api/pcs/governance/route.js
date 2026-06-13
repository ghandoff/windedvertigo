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
  DEFAULT_GOVERNANCE_CONFIG,
  isGovernanceEnabled,
} from '@/lib/review-gate.js';

export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'GET /api/pcs/governance',
  });
  if (gate.error) return gate.error;

  const config = await loadGovernanceConfig();

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

  const updated = await saveGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG,
    ...body,
    toggledAt: new Date().toISOString(),
    toggledBy: gate.user.email,
  });

  return NextResponse.json({
    ...updated,
    isEnabled: isGovernanceEnabled(updated),
  });
}

// ─── Config persistence stub ─────────────────────────────────────────────────
// TODO: persist to Supabase pcs_governance_config table once provisioned.
// For the preview this is an in-memory singleton; it resets on cold start.
// The UI reflects the current in-process state.

let _governanceConfig = { ...DEFAULT_GOVERNANCE_CONFIG };

async function loadGovernanceConfig() {
  return { ..._governanceConfig };
}

async function saveGovernanceConfig(config) {
  _governanceConfig = { ...config };
  return { ..._governanceConfig };
}
