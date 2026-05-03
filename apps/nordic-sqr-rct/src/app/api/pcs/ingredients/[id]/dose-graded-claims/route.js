/**
 * /api/pcs/ingredients/[id]/dose-graded-claims — Phase 4.6 Bundle D.1
 *
 * GET — returns the AICS-derived dose-graded claim catalog for a single
 *       active ingredient, grouped by demographic age group, sorted by
 *       minDose ascending. Cumulative-tier rule applies in the UI: at
 *       any chosen dose, all claims with minDose ≤ that dose are
 *       authorized.
 *
 * Capability: pcs.taxonomy:read (every PCS-role user has it).
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getIngredient } from '@/lib/pcs-ingredients';
import { getDoseGradedClaimsForIngredient } from '@/lib/ingredient-claim-catalog';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', {
    route: '/api/pcs/ingredients/[id]/dose-graded-claims',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const ing = await getIngredient(id);
    if (!ing) return NextResponse.json({ error: 'ingredient not found' }, { status: 404 });
    const catalog = await getDoseGradedClaimsForIngredient(ing.canonicalName);
    return NextResponse.json({
      ingredient: { id: ing.id, canonicalName: ing.canonicalName, standardUnit: ing.standardUnit },
      ...catalog,
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'failed to load catalog' }, { status: 500 });
  }
}
