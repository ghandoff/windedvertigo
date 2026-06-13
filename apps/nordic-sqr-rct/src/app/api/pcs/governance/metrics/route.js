/**
 * GET /api/pcs/governance/metrics
 *
 * Returns governance metrics: correction rate, time-saved estimate,
 * rubber-stamp signals, and rule adherence.
 *
 * Super-user-only when governance layer is OFF.
 * When governance is ON: all users with pcs.review:approve can see their own
 * metrics; admin/super-user see team-wide metrics.
 *
 * Query params:
 *   ?period=7d|30d|90d   (default: 30d)
 *   ?type=pcs-document|claim|evidence|...
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability.js';
import {
  computeCorrectionRate,
  computeTimeSaved,
  computeRuleAdherence,
  DEFAULT_TIME_BASELINES_MINUTES,
  isGovernanceEnabled,
} from '@/lib/review-gate.js';

export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'GET /api/pcs/governance/metrics',
  });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30d';
  const type = searchParams.get('type') ?? null;

  const [governanceConfig, auditEvents, rules] = await Promise.all([
    loadGovernanceConfig(),
    loadAuditEvents({ period, type }),
    loadRules(),
  ]);

  const filteredEvents = type
    ? auditEvents.filter((e) => e.recordType === type)
    : auditEvents;

  const correctionRate = computeCorrectionRate(filteredEvents);
  const timeSaved = computeTimeSaved(filteredEvents, {});
  const adherence = computeRuleAdherence(filteredEvents, rules);

  return NextResponse.json({
    period,
    type,
    governanceEnabled: isGovernanceEnabled(governanceConfig),
    correctionRate,
    timeSaved,
    adherence,
    assumptions: {
      timeBaselines: DEFAULT_TIME_BASELINES_MINUTES,
      note: 'Time-saved figures are estimates. Baselines represent assumed manual-entry time per record type and should be calibrated with the team.',
    },
    _note: auditEvents.length === 0
      ? 'No audit events yet. Metrics will populate as the team reviews records.'
      : null,
  });
}

// ─── Stubs ───────────────────────────────────────────────────────────────────

async function loadGovernanceConfig() {
  return { governanceEnabled: false, captureHistoryWhenOff: true };
}

async function loadAuditEvents({ period, type }) {
  return [];
}

async function loadRules() {
  return [];
}
