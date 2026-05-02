import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getRequest, updateRequest } from '@/lib/pcs-requests';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.requests:read', { route: '/api/pcs/requests/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const req = await getRequest(id);
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    return NextResponse.json(req);
  } catch (err) {
    if (err?.code === 'object_not_found') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    throw err;
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.requests:resolve-research', { route: '/api/pcs/requests/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const fields = await request.json();
    const req = await updateRequest(id, fields);
    return NextResponse.json(req);
  } catch (err) {
    if (err?.code === 'object_not_found') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    throw err;
  }
}
