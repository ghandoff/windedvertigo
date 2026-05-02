import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getBenefitCategory,
  updateBenefitCategory,
  deleteBenefitCategory,
} from '@/lib/pcs-benefit-categories';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/benefit-categories/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await getBenefitCategory(id);
  return NextResponse.json(row);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/benefit-categories/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const fields = await request.json();
  const row = await updateBenefitCategory(id, fields);
  return NextResponse.json(row);
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/benefit-categories/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  await deleteBenefitCategory(id);
  return NextResponse.json({ ok: true });
}
