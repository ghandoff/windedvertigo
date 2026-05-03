import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAicsDocument,
  getAicsVersionsForDocument,
  getAicsClaimsForVersion,
} from '@/lib/pcs-aics';

/**
 * GET /api/pcs/aics/[id]/claims — claims for the latest version of this
 * AICS doc. Resolves the latest version via the document's
 * `latestVersionId` relation; falls back to the newest-effective-date entry
 * in `getAicsVersionsForDocument` if the relation is unset.
 */
export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'aics.claims:read', {
    route: '/api/pcs/aics/[id]/claims',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const doc = await getAicsDocument(id);
    if (!doc) return NextResponse.json({ error: 'AICS document not found' }, { status: 404 });

    let versionId = doc.latestVersionId;
    if (!versionId) {
      const versions = await getAicsVersionsForDocument(id);
      versionId = versions[0]?.id || null;
    }
    if (!versionId) {
      // No versions yet — empty claim list rather than 404 so callers can
      // distinguish "doc exists, nothing to show" from "doc missing".
      return NextResponse.json({ versionId: null, items: [] });
    }

    const claims = await getAicsClaimsForVersion(versionId);
    return NextResponse.json({ versionId, items: claims });
  } catch (err) {
    if (err?.code === 'object_not_found') {
      return NextResponse.json({ error: 'AICS document not found' }, { status: 404 });
    }
    throw err;
  }
}
