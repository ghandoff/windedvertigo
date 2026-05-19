import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAicsVersionsForDocument, createAicsVersion } from '@/lib/aics-documents';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pcs/aics/[id]/versions — list all versions for an AICS doc.
 * Returns an array sorted by effectiveDate descending.
 */
export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'aics.documents:read', {
    route: '/api/pcs/aics/[id]/versions',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  const versions = await getAicsVersionsForDocument(id);
  return NextResponse.json(versions);
}

/**
 * POST /api/pcs/aics/[id]/versions — create a new version on an AICS doc.
 * Requires `aics.documents:edit` capability (RA+).
 *
 * Body: { version, effectiveDate?, changeDescription?, responsibleDept?,
 *          responsibleIndividual?, approvedBy?, isLatest? }
 * Response: the newly-created version object (201).
 */
export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'aics.documents:edit', {
    route: '/api/pcs/aics/[id]/versions',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  const fields = await request.json().catch(() => ({}));

  if (!fields?.version) {
    return NextResponse.json({ error: 'version is required.' }, { status: 400 });
  }

  const version = await createAicsVersion(id, fields);
  return NextResponse.json(version, { status: 201 });
}
