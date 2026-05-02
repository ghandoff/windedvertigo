import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { commitExtraction } from '@/lib/pcs-pdf-import';
import { getDocumentByPcsId } from '@/lib/pcs-documents';

// Commit does 30+ serial Notion writes per PCS document. Default 300s
// is tight for Lauren-template PDFs with 15+ evidence packets.
export const runtime = 'nodejs';
export const maxDuration = 600;
export const dynamic = 'force-dynamic';

/**
 * POST /api/pcs/import/commit — Commit reviewed extraction data to Notion.
 *
 * Body: { data: <extraction object>, existingDocId?: string }
 * The `data` object is the same shape returned by the extract endpoint,
 * potentially edited by the user during review.
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.imports:run', { route: '/api/pcs/import/commit' });
  if (auth.error) return auth.error;

  try {
    const { data, existingDocId } = await request.json();

    if (!data?.document?.pcsId && !existingDocId) {
      return NextResponse.json(
        { error: 'Extraction data with a PCS ID is required' },
        { status: 400 }
      );
    }

    // Check for duplicate PCS ID when creating a new document
    if (!existingDocId && data?.document?.pcsId) {
      const existing = await getDocumentByPcsId(data.document.pcsId);
      if (existing) {
        return NextResponse.json(
          {
            error: `A document with PCS ID "${data.document.pcsId}" already exists. Use the "Link to existing document" option instead.`,
            existingDocId: existing.id,
          },
          { status: 409 }
        );
      }
    }

    const result = await commitExtraction(data, existingDocId || null);

    return NextResponse.json({
      success: true,
      created: {
        documentId: result.documentId,
        versionId: result.versionId,
        claims: result.claimIds.length,
        formulaLines: result.formulaLineIds.length,
        references: result.referenceIds.length,
        revisionEvents: result.revisionEventIds.length,
        claimDoseReqs: result.claimDoseReqIds.length,
        evidencePackets: result.evidencePacketIds.length,
      },
      warnings: result.warnings || [],
    });
  } catch (error) {
    console.error('PCS import commit error:', error);
    return NextResponse.json(
      { error: error.message || 'Commit failed' },
      { status: 500 }
    );
  }
}
