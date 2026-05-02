import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllCoreBenefits,
  createCoreBenefit,
  resolveOrCreate,
} from '@/lib/pcs-core-benefits';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/core-benefits' });
  if (auth.error) return auth.error;
  const rows = await getAllCoreBenefits();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/core-benefits' });
  if (auth.error) return auth.error;
  const fields = await request.json();
  // Support resolve-or-create flow when ?resolve=1 is passed.
  const { searchParams } = new URL(request.url);
  if (searchParams.get('resolve') === '1') {
    const row = await resolveOrCreate(fields.coreBenefit, fields.benefitCategoryId || null);
    return NextResponse.json(row, { status: 200 });
  }
  const row = await createCoreBenefit(fields);
  return NextResponse.json(row, { status: 201 });
}
