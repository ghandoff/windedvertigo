import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getIngredient } from '@/lib/pcs-ingredients';
import { getFormulaLinesForIngredient } from '@/lib/pcs-formula-lines';
import { getAllVersions } from '@/lib/pcs-versions';
import { getAllDocuments } from '@/lib/pcs-documents';
import { queryByIngredient } from '@/lib/pcs-explorer';

/**
 * GET /api/pcs/caipb/ingredient/[id]
 *
 * Per-ingredient CAIPB dashboard data (Budget C super-user preview).
 *
 * Response:
 * {
 *   ingredient:       { id, canonicalName, category, standardUnit, ... },
 *   products:         [{ formulaLineId, aiForm, fmPlm, amountPerServing, amountUnit,
 *                        ingredientSource, pcsVersionId, pcsDocumentId, pcsId,
 *                        finishedGoodName }],
 *   formUsage:        [{ form, count, pct }],
 *   benefitCategories: [{ id, name, claimCount }],
 *   claims:           ExplorerRow[],
 *   region:           string | null,
 *   totalClaimCount:  number,
 * }
 */
export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.market-explorer:view', {
    route: '/api/pcs/caipb/ingredient/[id]',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') || null;

  const [ingredient, lines, versions, documents, claimRows] = await Promise.all([
    getIngredient(id),
    getFormulaLinesForIngredient(id),
    getAllVersions(),
    getAllDocuments(),
    queryByIngredient(id, { region }),
  ]);

  if (!ingredient) {
    return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
  }

  // Join formula lines → versions → documents to surface fmPlm + product info
  const versionById = Object.fromEntries(versions.map(v => [v.id, v]));
  const documentById = Object.fromEntries(documents.map(d => [d.id, d]));

  const products = lines.map(line => {
    const version = line.pcsVersionId ? versionById[line.pcsVersionId] : null;
    const doc = version?.pcsDocumentId ? documentById[version.pcsDocumentId] : null;
    return {
      formulaLineId: line.id,
      aiForm: line.aiForm || null,
      fmPlm: line.fmPlm || null,
      amountPerServing: line.amountPerServing ?? null,
      amountUnit: line.amountUnit || null,
      ingredientSource: line.ingredientSource || null,
      pcsVersionId: line.pcsVersionId || null,
      pcsDocumentId: doc?.id || version?.pcsDocumentId || null,
      pcsId: doc?.pcsId || null,
      finishedGoodName: doc?.finishedGoodName || null,
    };
  }).sort((a, b) =>
    (a.finishedGoodName || a.pcsId || '').localeCompare(b.finishedGoodName || b.pcsId || ''),
  );

  // Form usage rollup: count each aiForm across all products, compute percentage
  const formCounts = {};
  for (const p of products) {
    const form = p.aiForm || '(unknown form)';
    formCounts[form] = (formCounts[form] || 0) + 1;
  }
  const total = products.length || 1;
  const formUsage = Object.entries(formCounts)
    .map(([form, count]) => ({ form, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  // Derive benefit categories from unfiltered claim rows (always show the full list)
  const allClaimRows = region ? await queryByIngredient(id) : claimRows;
  const benefitCatMap = new Map();
  for (const row of allClaimRows) {
    if (!row.benefitCategory) continue;
    const { id: bcId, name } = row.benefitCategory;
    if (!benefitCatMap.has(bcId)) benefitCatMap.set(bcId, { id: bcId, name, claimCount: 0 });
    benefitCatMap.get(bcId).claimCount++;
  }
  const benefitCategories = [...benefitCatMap.values()]
    .sort((a, b) => b.claimCount - a.claimCount);

  return NextResponse.json({
    ingredient,
    products,
    formUsage,
    benefitCategories,
    claims: claimRows,
    region,
    totalClaimCount: allClaimRows.length,
  });
}
