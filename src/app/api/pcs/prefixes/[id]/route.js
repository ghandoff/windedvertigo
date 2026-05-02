import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getPrefix, updatePrefix, deletePrefix } from '@/lib/pcs-prefixes';
import { REGULATORY_TIERS } from '@/lib/pcs-config';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/prefixes/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await getPrefix(id);
  return NextResponse.json(row);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/prefixes/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const fields = await request.json();
  if (fields.regulatoryTier && !REGULATORY_TIERS.includes(fields.regulatoryTier)) {
    return NextResponse.json({ error: `Invalid regulatoryTier: ${fields.regulatoryTier}` }, { status: 400 });
  }
  const row = await updatePrefix(id, fields);
  return NextResponse.json(row);
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/prefixes/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  await deletePrefix(id);
  return NextResponse.json({ ok: true });
}
