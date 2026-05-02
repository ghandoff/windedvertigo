/**
 * GET /api/sqr/export/[scoreId]
 *
 * Generates a Word (.docx) "SQR-RCT Assisted Review" report for a single
 * score. Pulls together:
 *   1. The score itself (q1..q12, raw selections, reviewer, version)
 *   2. The study (citation, DOI, journal, design, funding, etc.)
 *   3. (optional) Linked PCS evidence by DOI/PMID match → packets → claims
 *   4. (optional) Per-claim applicability assessments
 *   5. (optional) Per-claim NutriGrade certainty rollup
 *
 * The applicability + certainty pull is best-effort: if no matching PCS
 * evidence is found for the study DOI, the report still renders with
 * just the RoB 2 + raw scores + key takeaway sections.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getScoreById, getStudyById } from '@/lib/notion';
import { getAllEvidence } from '@/lib/pcs-evidence';
import { getPacketsForEvidenceItem } from '@/lib/pcs-evidence-packets';
import { getApplicabilityForClaim } from '@/lib/applicability';
import { getClaim } from '@/lib/pcs-claims';
import { computeCertainty } from '@/lib/nutrigrade';
import { getApplicabilityForEvidence } from '@/lib/applicability';
import { generateAssistedReviewDoc, buildFilename, packDocument } from '@/lib/sqr-docx';

/** Normalize a DOI for case-insensitive comparison. */
function normDoi(d) {
  if (!d) return '';
  return String(d).trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

/**
 * Best-effort lookup of PCS evidence + claims for a study.
 * Returns { applicability: [...], certainty: [{ claimLabel, certainty, derivedInputs }] }
 * — both arrays may be empty if no link is found.
 */
async function gatherClaimContext(study) {
  const result = { applicability: [], certainty: [] };
  if (!study?.doi) return result;
  const target = normDoi(study.doi);
  if (!target) return result;

  let evidenceMatches = [];
  try {
    const allEvidence = await getAllEvidence();
    evidenceMatches = allEvidence.filter(e => normDoi(e.doi) === target);
  } catch (err) {
    console.warn('SQR export: evidence lookup failed', err.message);
    return result;
  }

  if (evidenceMatches.length === 0) return result;

  // Collect applicability records per matched evidence item
  const applSeen = new Set();
  for (const ev of evidenceMatches) {
    try {
      const recs = await getApplicabilityForEvidence(ev.id);
      for (const r of recs) {
        if (applSeen.has(r.id)) continue;
        applSeen.add(r.id);
        result.applicability.push(r);
      }
    } catch (err) {
      console.warn('SQR export: applicability lookup failed', err.message);
    }
  }

  // Collect linked claims via packets, then compute certainty per claim.
  const claimIds = new Set();
  for (const ev of evidenceMatches) {
    try {
      const packets = await getPacketsForEvidenceItem(ev.id);
      for (const p of packets) {
        if (p.pcsClaimId) claimIds.add(p.pcsClaimId);
      }
    } catch (err) {
      console.warn('SQR export: packet lookup failed', err.message);
    }
  }

  for (const claimId of claimIds) {
    try {
      const [claim, applForClaim] = await Promise.all([
        getClaim(claimId),
        getApplicabilityForClaim(claimId),
      ]);
      const sqrScores = evidenceMatches.map(e => e.sqrScore).filter(s => s != null);
      const sqrMean = sqrScores.length > 0
        ? sqrScores.reduce((a, b) => a + b, 0) / sqrScores.length
        : null;
      const applScores = applForClaim.map(a => a.applicabilityScore).filter(s => s != null);
      const applicabilityMean = applScores.length > 0
        ? applScores.reduce((a, b) => a + b, 0) / applScores.length
        : null;

      const certainty = computeCertainty({
        sqrMean,
        applicabilityMean,
        evidenceCount: evidenceMatches.length,
        heterogeneity: claim.heterogeneity,
        publicationBias: claim.publicationBias,
        fundingBias: claim.fundingBias,
        precision: claim.precision,
        effectSizeCategory: claim.effectSizeCategory,
        doseResponseGradient: claim.doseResponseGradient,
      });

      result.certainty.push({
        claimLabel: `Claim #${claim.claimNo || '—'}: ${claim.claim || 'Untitled'}`,
        certainty,
        derivedInputs: {
          sqrMean,
          applicabilityMean,
          evidenceCount: evidenceMatches.length,
        },
      });
    } catch (err) {
      console.warn('SQR export: certainty computation failed for claim', claimId, err.message);
    }
  }

  return result;
}

export async function GET(request, { params }) {
  try {
    // Wave 7.5 Batch C — only roles with `sqr.scores:read-all` may export
    // an arbitrary score's full assisted-review report.
    const gate = await requireCapability(request, 'sqr.scores:read-all', { route: '/api/sqr/export/[scoreId]' });
    if (gate.error) return gate.error;

    const { scoreId } = await params;
    if (!scoreId) {
      return NextResponse.json({ error: 'scoreId is required' }, { status: 400 });
    }

    const score = await getScoreById(scoreId);
    if (!score) {
      return NextResponse.json({ error: 'Score not found' }, { status: 404 });
    }

    const studyId = score.studyRelation?.[0];
    const study = studyId ? await getStudyById(studyId) : null;

    const { applicability, certainty } = await gatherClaimContext(study);

    const doc = generateAssistedReviewDoc({ score, study, applicability, certainty });
    const buffer = await packDocument(doc);
    const filename = buildFilename(study);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('SQR export error:', err);
    return NextResponse.json({ error: 'Report generation failed', details: err.message }, { status: 500 });
  }
}
