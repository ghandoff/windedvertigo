import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getFormsForIngredient } from '@/lib/pcs-ingredient-forms';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/ingredients/[id]/forms' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const forms = await getFormsForIngredient(id);
  return NextResponse.json(forms);
}
