import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAicsDocument,
  getAicsVersionsForDocument,
  getAicsClaimsForVersion,
  createAicsClaim,
} from '@/lib/aics-documents';

export const dynamic = 'force-dynamic';

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

/**
 * POST /api/pcs/aics/[id]/claims — create a new claim on the latest version
 * of this AICS document. Requires `aics.claims:edit` capability (RA+).
 *
 * Body: { claimId, claimText?, claimNo?, versionId?, ...claim fields }
 * Response: the newly-created claim object.
 */
export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'aics.claims:edit', {
    route: '/api/pcs/aics/[id]/claims',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body?.claimId) {
    return NextResponse.json({ error: 'claimId is required.' }, { status: 400 });
  }

  // Resolve target version: body may supply an explicit versionId override;
  // otherwise use isLatest or first available version.
  let versionId = body.versionId || null;
  if (!versionId) {
    const versions = await getAicsVersionsForDocument(id);
    const latest = versions.find((v) => v.isLatest) || versions[0] || null;
    if (!latest) {
      return NextResponse.json(
        { error: 'Create a version before adding claims.' },
        { status: 422 },
      );
    }
    versionId = latest.id;
  }

  const claim = await createAicsClaim(id, versionId, body);
  return NextResponse.json(claim, { status: 201 });
}
