import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getBenefitCategory } from '@/lib/pcs-benefit-categories';
import { queryByBenefitCategory } from '@/lib/pcs-explorer';
import { getAllVersions } from '@/lib/pcs-versions';
import { getAllDocuments } from '@/lib/pcs-documents';

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

  const [benefitCategory, claimRows, versions, documents] = await Promise.all([
    getBenefitCategory(id),
    queryByBenefitCategory(id, { region }),
    getAllVersions(),
    getAllDocuments(),
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

  // Aggregate products that support this benefit. A claim row carries a
  // pcsVersionId; resolve version → document so each product (finished good)
  // is surfaced with a name/pcsId and a deep link, and multiple versions of
  // the same document collapse into one product row.
  const versionById = Object.fromEntries(versions.map(v => [v.id, v]));
  const documentById = Object.fromEntries(documents.map(d => [d.id, d]));

  const productMap = new Map();
  for (const row of allClaimRows) {
    if (!row.pcsVersionId) continue;
    const version = versionById[row.pcsVersionId];
    const doc = version?.pcsDocumentId ? documentById[version.pcsDocumentId] : null;
    // Key by document when resolvable; otherwise fall back to the version id so
    // counts are never silently dropped.
    const key = doc?.id || `version:${row.pcsVersionId}`;
    if (!productMap.has(key)) {
      productMap.set(key, {
        id: doc?.id || null,
        name: doc?.finishedGoodName || doc?.pcsId || null,
        pcsId: doc?.pcsId || null,
        claimCount: 0,
      });
    }
    productMap.get(key).claimCount++;
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
