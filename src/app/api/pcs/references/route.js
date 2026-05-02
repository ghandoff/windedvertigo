import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllReferences, getReferencesForVersion,
  getUnlinkedReferences, createReference,
} from '@/lib/pcs-references';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/references' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('versionId');
  const unlinked = searchParams.get('unlinked');

  let refs;
  if (versionId) {
    refs = await getReferencesForVersion(versionId);
  } else if (unlinked === 'true') {
    refs = await getUnlinkedReferences();
  } else {
    refs = await getAllReferences();
  }
  return NextResponse.json(refs);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/references' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  const ref = await createReference(fields);
  return NextResponse.json(ref, { status: 201 });
}
