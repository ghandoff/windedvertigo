import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getDocument, updateDocument } from '@/lib/pcs-documents';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.documents:read', { route: '/api/pcs/documents/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const doc = await getDocument(id);
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json(doc);
  } catch (err) {
    if (err?.code === 'object_not_found') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    throw err;
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.documents:edit', { route: '/api/pcs/documents/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const fields = await request.json();
    const doc = await updateDocument(id, fields);
    return NextResponse.json(doc);
  } catch (err) {
    if (err?.code === 'object_not_found') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    throw err;
  }
}
