import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getCoreBenefit,
  updateCoreBenefit,
  deleteCoreBenefit,
} from '@/lib/pcs-core-benefits';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/core-benefits/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await getCoreBenefit(id);
  return NextResponse.json(row);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/core-benefits/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const fields = await request.json();
  const row = await updateCoreBenefit(id, fields);
  return NextResponse.json(row);
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/core-benefits/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  await deleteCoreBenefit(id);
  return NextResponse.json({ ok: true });
}
