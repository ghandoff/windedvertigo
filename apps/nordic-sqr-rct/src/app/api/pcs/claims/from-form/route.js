/**
 * POST /api/pcs/claims/from-form — Bundle 4 Phase 2
 *
 * Adapts the controlled-vocab form payload from PcsClaimFormFields into the
 * existing createClaim() contract. Composes a structured `claim` text from
 * prefix + benefit + claim core, derives `claimBucket` from grade, and
 * stashes the full structured payload as JSON in `documentNotes` so a
 * future Phase 4.3 backfill can re-hydrate the relational fields once
 * cv_active_ingredients / cv_claim_prefixes have Notion-page-id mirrors.
 *
 * Capability gate: `pcs.claims:author` (matches the existing /api/pcs/claims).
 *
 * Form payload shape:
 *   { activeIngredientCode, aiFormCode, doseAmount, doseUnit,
 *     ageCodes[], sexCodes[], lifestageCodes[], lifestyleCodes[],
 *     benefitCategoryCode, claimPrefixCode, claimText, gradeCode,
 *     pcsVersionId }
 *
 * Required: claimText, pcsVersionId, at least one demographic age code.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { createClaim } from '@/lib/pcs-claims';

const GRADE_TO_BUCKET = { A: '3A', B: '3B', C: '3C' };

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.claims:author', { route: '/api/pcs/claims/from-form' });
  if (auth.error) return auth.error;

  let payload;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON body required' }, { status: 400 }); }

  const claimText = (payload.claimText || '').trim();
  const pcsVersionId = payload.pcsVersionId;
  const ageCodes = Array.isArray(payload.ageCodes) ? payload.ageCodes : [];

  // Validation.
  if (!claimText) return NextResponse.json({ error: 'claimText is required' }, { status: 400 });
  if (!pcsVersionId) return NextResponse.json({ error: 'pcsVersionId is required (pick a target PCS version)' }, { status: 400 });
  if (ageCodes.length === 0) return NextResponse.json({ error: 'at least one demographic age group is required' }, { status: 400 });

  // Compose claim text: "<Benefit category>: <prefix> <claim core>"
  const benefit = payload.benefitCategoryCode ? humanizeCode(payload.benefitCategoryCode) : null;
  const prefix = payload.claimPrefixCode ? humanizeCode(payload.claimPrefixCode) : null;
  const composedClaim = [
    benefit ? `${benefit}:` : null,
    prefix,
    claimText,
  ].filter(Boolean).join(' ');

  // Derive bucket from grade.
  const claimBucket = GRADE_TO_BUCKET[(payload.gradeCode || '').toUpperCase()] || null;

  // Stash structured payload as JSON in documentNotes so Phase 4.3 can
  // backfill relational fields once cv_active_ingredients gets Notion ids.
  const stash = {
    _form: 'Bundle 4 P2',
    activeIngredientCode: payload.activeIngredientCode || null,
    aiFormCode: payload.aiFormCode || null,
    dose: payload.doseAmount ? { amount: payload.doseAmount, unit: payload.doseUnit || null } : null,
    demographics: {
      age: ageCodes,
      sex: payload.sexCodes || [],
      lifestage: payload.lifestageCodes || [],
      lifestyle: payload.lifestyleCodes || [],
    },
    benefit: payload.benefitCategoryCode || null,
    prefix: payload.claimPrefixCode || null,
    grade: payload.gradeCode || null,
    submittedAt: new Date().toISOString(),
  };

  try {
    const fields = {
      claim: composedClaim,
      pcsVersionId,
      ...(claimBucket ? { claimBucket } : {}),
      claimStatus: 'Pending',
      // Persist the structured payload alongside the claim so Phase 4.3
      // can restore relational fields. Notion rich_text limit is 2000 chars
      // per block; the JSON below stays well under that.
      documentNotes: `[Bundle 4 P2 form-driven entry]\n${JSON.stringify(stash, null, 2)}`,
    };
    const created = await createClaim(fields);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'create failed' }, { status: 500 });
  }
}

function humanizeCode(code) {
  if (!code) return '';
  // Snake-case → spaces; capitalize first letter.
  const s = String(code).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
