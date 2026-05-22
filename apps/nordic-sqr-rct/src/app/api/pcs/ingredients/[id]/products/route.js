import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getFormulaLinesForIngredient } from '@/lib/pcs-formula-lines';
import { getAllVersions } from '@/lib/pcs-versions';
import { getAllDocuments } from '@/lib/pcs-documents';

/**
 * GET /api/pcs/ingredients/[id]/products
 *
 * Returns the list of PCS products (documents) that contain this active
 * ingredient, joined from formula_lines → versions → documents.
 *
 * Response shape:
 * {
 *   products: [
 *     {
 *       formulaLineId: string,
 *       ai: string,
 *       aiForm: string | null,
 *       amountPerServing: number | null,
 *       amountUnit: string | null,
 *       percentDailyValue: number | null,
 *       ingredientSource: string,
 *       pcsVersionId: string | null,
 *       pcsDocumentId: string | null,
 *       pcsId: string | null,
 *       finishedGoodName: string | null,
 *       format: string | null,
 *     }
 *   ]
 * }
 */
export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', {
    route: '/api/pcs/ingredients/[id]/products',
  });
  if (auth.error) return auth.error;

  const { id } = await params;

  // Fetch formula lines for this ingredient + all versions + all documents in parallel.
  // Documents (~20–50 rows) and versions are small tables; fetching all is fine.
  const [lines, versions, documents] = await Promise.all([
    getFormulaLinesForIngredient(id),
    getAllVersions(),
    getAllDocuments(),
  ]);

  // Build lookup maps for O(1) joins.
  const versionById = Object.fromEntries(versions.map(v => [v.id, v]));
  const documentById = Object.fromEntries(documents.map(d => [d.id, d]));

  const products = lines.map(line => {
    const version = line.pcsVersionId ? versionById[line.pcsVersionId] : null;
    const document = version?.pcsDocumentId ? documentById[version.pcsDocumentId] : null;

    return {
      formulaLineId: line.id,
      ai: line.ai || null,
      aiForm: line.aiForm || null,
      amountPerServing: line.amountPerServing,
      amountUnit: line.amountUnit || null,
      percentDailyValue: line.percentDailyValue,
      ingredientSource: line.ingredientSource || null,
      pcsVersionId: line.pcsVersionId || null,
      pcsDocumentId: document?.id || version?.pcsDocumentId || null,
      pcsId: document?.pcsId || null,
      finishedGoodName: document?.finishedGoodName || null,
      format: document?.format || null,
    };
  });

  // Sort by product name for stable display.
  products.sort((a, b) =>
    (a.finishedGoodName || a.pcsId || '').localeCompare(b.finishedGoodName || b.pcsId || ''),
  );

  return NextResponse.json({ products });
}
