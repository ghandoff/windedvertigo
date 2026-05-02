/**
 * Per-claim NutriGrade certainty rollup endpoint.
 *
 * GET  — compute the rollup on the fly (read-only, live; does not
 *         write to Notion).
 * POST — compute the rollup AND persist `Certainty score` and
 *         `Certainty rating` on the PCS Claim row so the value is
 *         visible in Notion views and available to dashboards.
 *
 * Why a separate endpoint (not part of PATCH /api/pcs/claims/[id]):
 * the rollup depends on reading evidence packets + evidence items +
 * applicability assessments. Keeping the computation in one place
 * avoids drift between "what the UI shows" and "what's written to
 * Notion." Callers should read the computed values from this endpoint
 * rather than recompute client-side.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getClaim, updateClaim } from '@/lib/pcs-claims';
import { getPacketsForClaim } from '@/lib/pcs-evidence-packets';
import { getApplicabilityForClaim } from '@/lib/applicability';
import { getAllEvidenceEntries } from '@/lib/pcs';
import { computeCertainty } from '@/lib/nutrigrade';

/**
 * Gather the derived inputs (sqrMean, applicabilityMean, evidenceCount)
 * from existing Notion data for a given claim.
 */
async function gatherDerivedInputs(claimId) {
  const [packets, applicability] = await Promise.all([
    getPacketsForClaim(claimId),
    getApplicabilityForClaim(claimId),
  ]);

  const evidenceIds = [...new Set(packets.map(p => p.evidenceItemId).filter(Boolean))];
  const evidenceCount = evidenceIds.length;

  // Fetch evidence items to get SQR scores. We only need the scores,
  // so a single query for all evidence + filter is faster than N
  // individual retrievals when there are many linked studies.
  let sqrMean = null;
  if (evidenceIds.length > 0) {
    const allEvidence = await getAllEvidenceEntries();
    const idSet = new Set(evidenceIds);
    const linkedScores = allEvidence
      .filter(e => idSet.has(e.id))
      .map(e => e.sqrScore)
      .filter(s => s != null);
    if (linkedScores.length > 0) {
      sqrMean = linkedScores.reduce((a, b) => a + b, 0) / linkedScores.length;
    }
  }

  let applicabilityMean = null;
  const applScores = applicability.map(a => a.applicabilityScore).filter(s => s != null);
  if (applScores.length > 0) {
    applicabilityMean = applScores.reduce((a, b) => a + b, 0) / applScores.length;
  }

  return { sqrMean, applicabilityMean, evidenceCount, packets, applicability };
}

async function computeForClaim(claimId) {
  const [claim, derived] = await Promise.all([
    getClaim(claimId),
    gatherDerivedInputs(claimId),
  ]);

  const certainty = computeCertainty({
    sqrMean: derived.sqrMean,
    applicabilityMean: derived.applicabilityMean,
    evidenceCount: derived.evidenceCount,
    heterogeneity: claim.heterogeneity,
    publicationBias: claim.publicationBias,
    fundingBias: claim.fundingBias,
    precision: claim.precision,
    effectSizeCategory: claim.effectSizeCategory,
    doseResponseGradient: claim.doseResponseGradient,
  });

  return {
    claim,
    derivedInputs: {
      sqrMean: derived.sqrMean,
      applicabilityMean: derived.applicabilityMean,
      evidenceCount: derived.evidenceCount,
      applicabilityCount: derived.applicability.length,
    },
    certainty,
  };
}

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.claims:read', { route: '/api/pcs/claims/[id]/certainty' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const result = await computeForClaim(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Certainty GET error:', err);
    return NextResponse.json({ error: 'Failed to compute certainty', details: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'pcs.claims:edit-certainty', { route: '/api/pcs/claims/[id]/certainty' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const result = await computeForClaim(id);
    // Persist only the computed values; RA inputs are set via the
    // normal PATCH /api/pcs/claims/[id] flow so this call is pure
    // "recompute and save."
    await updateClaim(id, {
      certaintyScore: result.certainty.score,
      certaintyRating: result.certainty.rating,
    });
    return NextResponse.json({ ...result, persisted: true });
  } catch (err) {
    console.error('Certainty POST error:', err);
    return NextResponse.json({ error: 'Failed to persist certainty', details: err.message }, { status: 500 });
  }
}
