import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getFormulaLinesForVersion } from '@/lib/pcs-formula-lines';
import { getAicsDocumentsByIngredientName, getAicsClaimsForVersion } from '@/lib/aics-documents';

/**
 * GET /api/pcs/aics/claims-for-product?versionId={id}
 *
 * Returns AICS-approved claims grouped by ingredient, scoped to the ingredients
 * present in this PCS version's formula lines. Used by the AICS claim picker in
 * Table 3 (PcsClaimsSection) to pre-populate "Add from AICS" dropdown.
 *
 * Response shape:
 * [
 *   {
 *     ingredientName: string,
 *     aicsDocId: string,
 *     aicsDocAicsId: string,    // e.g. "AICS-0001"
 *     claims: [
 *       { id, claimText, minDose, minDoseUnit, ageGroup, grade, claimStatus }
 *     ]
 *   },
 *   ...
 * ]
 *
 * Only includes ingredients with at least one approved AICS document, and only
 * claims with claimStatus === 'Approved'. Ingredients without an approved AICS
 * are silently omitted.
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.claims:read', { route: '/api/pcs/aics/claims-for-product' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('versionId');
  if (!versionId) {
    return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
  }

  // 1. Get formula lines for this version to find the ingredient names.
  const formulaLines = await getFormulaLinesForVersion(versionId);
  const ingredientNames = [...new Set(
    formulaLines
      .map(fl => fl.ai || fl.ingredientForm || '')
      .filter(Boolean)
  )];

  if (ingredientNames.length === 0) {
    return NextResponse.json([]);
  }

  // 2. For each ingredient, find approved AICS docs and their claims.
  const results = [];
  for (const name of ingredientNames) {
    const aicsDocs = await getAicsDocumentsByIngredientName(name, { raReviewStatus: 'Approved' });
    for (const doc of aicsDocs) {
      const vId = doc.latestVersionId;
      if (!vId) continue;
      let claims;
      try {
        claims = await getAicsClaimsForVersion(vId);
      } catch {
        continue;
      }
      const approved = claims.filter(c => c.claimStatus === 'Approved');
      if (approved.length === 0) continue;
      results.push({
        ingredientName: name,
        aicsDocId: doc.id,
        aicsDocAicsId: doc.aicsId || doc.id,
        claims: approved.map(c => ({
          id: c.id,
          claimText: c.claimText || c.claimId || '',
          minDose: c.minDose ?? null,
          minDoseUnit: c.minDoseUnit || null,
          ageGroup: c.ageGroup || null,
          grade: c.grade || null,
          claimStatus: c.claimStatus,
        })),
      });
    }
  }

  return NextResponse.json(results);
}
