import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getBenefitCategory } from '@/lib/pcs-benefit-categories';
import { queryByBenefitCategory } from '@/lib/pcs-explorer';

/**
 * GET /api/pcs/caipb/benefit/[id]
 *
 * Per-benefit-category CAIPB dashboard data (Budget C super-user preview).
 *
 * Response:
 * {
 *   benefitCategory: { id, name },
 *   claims:          ExplorerRow[],
 *   ingredients:     [{ id, name, claimCount }],
 *   products:        [{ id, name, pcsId, claimCount }],
 *   region:          string | null,
 *   totalClaimCount: number,
 * }
 */
export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.market-explorer:view', {
    route: '/api/pcs/caipb/benefit/[id]',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') || null;

  const [benefitCategory, claimRows] = await Promise.all([
    getBenefitCategory(id),
    queryByBenefitCategory(id, { region }),
  ]);

  if (!benefitCategory) {
    return NextResponse.json({ error: 'Benefit category not found' }, { status: 404 });
  }

  const allClaimRows = region ? await queryByBenefitCategory(id) : claimRows;

  // Aggregate ingredients that support this benefit category
  const ingredientMap = new Map();
  for (const row of allClaimRows) {
    if (!row.ingredient) continue;
    const { id: ingId, name } = row.ingredient;
    if (!ingredientMap.has(ingId)) ingredientMap.set(ingId, { id: ingId, name, claimCount: 0 });
    ingredientMap.get(ingId).claimCount++;
  }
  const ingredients = [...ingredientMap.values()]
    .sort((a, b) => b.claimCount - a.claimCount);

  // Aggregate products (via pcsVersionId → document) — use claim rows' pcsVersionId
  // The document link is captured in the ExplorerRow as pcsRef; for now surface
  // unique versions as a proxy. Full product join requires the version→document map
  // which lives in buildExplorerIndex. We surface what's available in claimRows.
  const productMap = new Map();
  for (const row of allClaimRows) {
    if (!row.pcsVersionId) continue;
    if (!productMap.has(row.pcsVersionId)) {
      productMap.set(row.pcsVersionId, {
        pcsVersionId: row.pcsVersionId,
        claimCount: 0,
      });
    }
    productMap.get(row.pcsVersionId).claimCount++;
  }
  const products = [...productMap.values()]
    .sort((a, b) => b.claimCount - a.claimCount);

  const bcName = benefitCategory.benefitCategory || benefitCategory.name || '';

  return NextResponse.json({
    benefitCategory: { id: benefitCategory.id, name: bcName },
    claims: claimRows,
    ingredients,
    products,
    region,
    totalClaimCount: allClaimRows.length,
  });
}
