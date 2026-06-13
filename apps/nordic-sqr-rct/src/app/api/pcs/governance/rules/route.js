/**
 * GET  /api/pcs/governance/rules  — list all gate rules
 * POST /api/pcs/governance/rules  — create a new gate rule (admin/RA)
 *
 * Gate rules define:
 *   - Which mode applies per record type (human-first, human-first-ai-verify, etc.)
 *   - Whether dual review is required
 *   - Minimum confidence for auto-approve
 *   - Any additional constraints
 *
 * Rule shape:
 *   {
 *     id: string,
 *     recordType: string,
 *     requiredMode?: string,        // GATE_MODES.*
 *     requireDualReview?: boolean,
 *     minConfidenceForAutoApprove?: number,
 *     blockAutoApproveBelow?: number,
 *     description: string,
 *     active: boolean,
 *     createdBy: string,
 *     createdAt: string,
 *   }
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability.js';
import { GATE_MODES } from '@/lib/review-gate.js';

export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'GET /api/pcs/governance/rules',
  });
  if (gate.error) return gate.error;

  const rules = await loadRules();
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

  const rule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    recordType: body.recordType,
    requiredMode: body.requiredMode ?? null,
    requireDualReview: body.requireDualReview ?? false,
    minConfidenceForAutoApprove: body.minConfidenceForAutoApprove ?? null,
    blockAutoApproveBelow: body.blockAutoApproveBelow ?? null,
    description: body.description,
    active: body.active !== false,
    createdBy: gate.user.email,
    createdAt: new Date().toISOString(),
  };

  await saveRule(rule);

  return NextResponse.json({ rule }, { status: 201 });
}

// ─── Rules persistence stub ──────────────────────────────────────────────────
// TODO: persist to Supabase pcs_governance_rules table once provisioned.
// Preview ships with default rules matching Sharon's stated preferences.

const DEFAULT_RULES = [
  {
    id: 'rule_default_pcs_document',
    recordType: 'pcs-document',
    requiredMode: GATE_MODES.HUMAN_FIRST_AI_VERIFY,
    requireDualReview: false,
    minConfidenceForAutoApprove: null,
    blockAutoApproveBelow: null,
    description: 'Articles must be read and entered by a human first; AI verifies alignment afterward. (Sharon\'s preference for PCS document entry.)',
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule_default_canonical_claim',
    recordType: 'canonical-claim',
    requiredMode: null,
    requireDualReview: false,
    minConfidenceForAutoApprove: null,
    blockAutoApproveBelow: null,
    description: 'Canonical claims require RA sign-off before publish.',
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  },
];

let _rules = [...DEFAULT_RULES];

async function loadRules() {
  return [..._rules];
}

async function saveRule(rule) {
  _rules = [..._rules, rule];
  return rule;
}
