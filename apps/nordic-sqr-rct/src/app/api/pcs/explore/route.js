/**
 * GET /api/pcs/explore
 *
 * Budget C Preview — Marketing Intelligence Interface query endpoint.
 * Super-user-only via pcs.market-explorer:view capability.
 *
 * Query params:
 *   lens=benefit&id=<benefitCategoryId>   — By Benefit Category
 *   lens=ingredient&id=<ingredientId>     — By Ingredient
 *   lens=product&id=<documentId>          — By Product
 *   (no params)                           — Returns filter options for all lenses
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  queryByBenefitCategory,
  queryByIngredient,
  queryByProduct,
  getExplorerOptions,
} from '@/lib/pcs-explorer';

// No public edge caching — super-user-only, and results contain PCS data
// that isn't approved for wider distribution yet.
export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.market-explorer:view', {
    route: '/api/pcs/explore',
  });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const lens = searchParams.get('lens');
  const id = searchParams.get('id');

  // No lens param → return filter options for UI dropdowns
  if (!lens) {
    const options = await getExplorerOptions();
    return NextResponse.json(options);
  }

  if (!id) {
    return NextResponse.json({ error: 'id param required when lens is set' }, { status: 400 });
  }

  let rows;
  if (lens === 'benefit') {
    rows = await queryByBenefitCategory(id);
  } else if (lens === 'ingredient') {
    rows = await queryByIngredient(id);
  } else if (lens === 'product') {
    rows = await queryByProduct(id);
  } else {
    return NextResponse.json({ error: `unknown lens: ${lens}` }, { status: 400 });
  }

  return NextResponse.json({ lens, id, rows });
}
