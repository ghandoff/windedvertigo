import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getDocument } from '@/lib/pcs-documents';
import { getVersionsForDocument } from '@/lib/pcs-versions';
import { getFormulaLinesForVersion } from '@/lib/pcs-formula-lines';
import { queryByProduct } from '@/lib/pcs-explorer';

/**
 * GET /api/pcs/caipb/product/[id]
 *
 * Per-product CAIPB dashboard data (Budget C super-user preview).
 * [id] is the PCS document's notion_page_id.
 *
 * Response:
 * {
 *   document:        { id, pcsId, finishedGoodName, format, fileStatus, latestVersionId },
 *   versions:        [{ id, versionLabel, effectiveDate, pcsDocumentId }],
 *   formulaLines:    [{ id, ai, aiForm, fmPlm, amountPerServing, amountUnit, ingredientSource }],
 *   claims:          ExplorerRow[],
 *   region:          string | null,
 *   totalClaimCount: number,
 * }
 */
export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.market-explorer:view', {
    route: '/api/pcs/caipb/product/[id]',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') || null;

  const [document, versions, claimRows] = await Promise.all([
    getDocument(id),
    getVersionsForDocument(id),
    queryByProduct(id, { region }),
  ]);

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Load formula lines for the latest version
  const latestVersion = document.latestVersionId
    ? versions.find(v => v.id === document.latestVersionId) || versions[0] || null
    : versions[0] || null;

  const formulaLines = latestVersion
    ? (await getFormulaLinesForVersion(latestVersion.id)).map(line => ({
        id: line.id,
        ai: line.ai || null,
        aiForm: line.aiForm || null,
        fmPlm: line.fmPlm || null,
        amountPerServing: line.amountPerServing ?? null,
        amountUnit: line.amountUnit || null,
        ingredientSource: line.ingredientSource || null,
        percentDailyValue: line.percentDailyValue ?? null,
      }))
    : [];

  const allClaimRows = region ? await queryByProduct(id) : claimRows;

  return NextResponse.json({
    document: {
      id: document.id,
      pcsId: document.pcsId,
      finishedGoodName: document.finishedGoodName,
      format: document.format,
      fileStatus: document.fileStatus,
      latestVersionId: document.latestVersionId,
    },
    versions: versions.map(v => ({
      id: v.id,
      versionLabel: v.versionLabel || null,
      effectiveDate: v.effectiveDate || null,
      pcsDocumentId: v.pcsDocumentId || null,
    })),
    formulaLines,
    claims: claimRows,
    region,
    totalClaimCount: allClaimRows.length,
  });
}
