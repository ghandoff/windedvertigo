import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllDocuments, getDocumentsByStatus, createDocument } from '@/lib/pcs-documents';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.documents:read', { route: '/api/pcs/documents' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const docs = status ? await getDocumentsByStatus(status) : await getAllDocuments();
  return NextResponse.json(docs);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.documents:create-version', { route: '/api/pcs/documents' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.pcsId) {
    return NextResponse.json({ error: 'pcsId is required' }, { status: 400 });
  }
  const doc = await createDocument(fields);
  return NextResponse.json(doc, { status: 201 });
}
