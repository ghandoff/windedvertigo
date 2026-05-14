import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { listAicsDocuments, createAicsDocument } from '@/lib/aics-documents';

export async function GET(request) {
  const auth = await requireCapability(request, 'aics.documents:read', { route: '/api/pcs/aics' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Number(searchParams.get('limit') || 100);

  const result = await listAicsDocuments({ limit, cursor, status });
  return NextResponse.json(result);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'aics.documents:create', { route: '/api/pcs/aics' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields?.aicsId) {
    return NextResponse.json({ error: 'aicsId is required' }, { status: 400 });
  }
  const doc = await createAicsDocument(fields);
  return NextResponse.json(doc, { status: 201 });
}
