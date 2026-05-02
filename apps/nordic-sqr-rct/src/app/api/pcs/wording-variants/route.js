import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllWordingVariants, getVariantsForClaim, createWordingVariant,
} from '@/lib/pcs-wording-variants';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/wording-variants' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const claimId = searchParams.get('claimId');

  const variants = claimId
    ? await getVariantsForClaim(claimId)
    : await getAllWordingVariants();
  return NextResponse.json(variants);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/wording-variants' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.wording) {
    return NextResponse.json({ error: 'wording text is required' }, { status: 400 });
  }
  const variant = await createWordingVariant(fields);
  return NextResponse.json(variant, { status: 201 });
}
