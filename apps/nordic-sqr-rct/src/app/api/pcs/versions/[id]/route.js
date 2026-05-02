import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getVersion, updateVersion } from '@/lib/pcs-versions';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.documents:read', { route: '/api/pcs/versions/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  const version = await getVersion(id);
  return NextResponse.json(version);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.documents:edit', { route: '/api/pcs/versions/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  const fields = await request.json();
  const version = await updateVersion(id, fields);
  return NextResponse.json(version);
}
