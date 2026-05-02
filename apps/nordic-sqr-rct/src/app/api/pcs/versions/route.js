import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllVersions, getVersionsForDocument, createVersion } from '@/lib/pcs-versions';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.documents:read', { route: '/api/pcs/versions' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  const versions = documentId
    ? await getVersionsForDocument(documentId)
    : await getAllVersions();
  return NextResponse.json(versions);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.documents:create-version', { route: '/api/pcs/versions' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.version) {
    return NextResponse.json({ error: 'version is required' }, { status: 400 });
  }
  const version = await createVersion(fields);
  return NextResponse.json(version, { status: 201 });
}
