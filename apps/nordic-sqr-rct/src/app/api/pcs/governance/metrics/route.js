/**
 * GET /api/pcs/governance/metrics
 *
 * Governance metrics: correction rate, time-saved estimate, rubber-stamp
 * signals, and rule adherence. Reads from the pcs_review_events audit log.
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
import {
  getGovernanceConfig,
  getGovernanceRules,
  getReviewEventsPeriod,
} from '@/lib/pcs-review-events.js';

export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'GET /api/pcs/governance/metrics',
  });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get('period') ?? '30d';
  const type = searchParams.get('type') ?? null;

  const periodDays = periodParam === '7d' ? 7 : periodParam === '90d' ? 90 : 30;

  const [governanceConfig, rules, auditEvents] = await Promise.all([
    getGovernanceConfig(),
    getGovernanceRules(),
    getReviewEventsPeriod({ periodDays, recordType: type }),
  ]);

  const correctionRate = computeCorrectionRate(auditEvents);
  const timeSaved = computeTimeSaved(auditEvents, {});
  const adherence = computeRuleAdherence(auditEvents, rules);

  return NextResponse.json({
    period: periodParam,
    periodDays,
    type,
    governanceEnabled: isGovernanceEnabled(governanceConfig),
    correctionRate,
    timeSaved,
    adherence,
    eventCount: auditEvents.length,
    assumptions: {
      timeBaselines: DEFAULT_TIME_BASELINES_MINUTES,
      note: 'Time-saved figures are estimates. Baselines represent assumed manual-entry time per record type and should be calibrated with the team.',
    },
    _note: auditEvents.length === 0
      ? 'No audit events in this period. Metrics will populate as the team reviews records.'
      : null,
  });
}
