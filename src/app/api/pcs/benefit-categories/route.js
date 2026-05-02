import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllBenefitCategories,
  createBenefitCategory,
  getChildren,
} from '@/lib/pcs-benefit-categories';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/benefit-categories' });
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get('parentId');
  const rows = parentId ? await getChildren(parentId) : await getAllBenefitCategories();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/benefit-categories' });
  if (auth.error) return auth.error;
  const fields = await request.json();
  const row = await createBenefitCategory(fields);
  return NextResponse.json(row, { status: 201 });
}
