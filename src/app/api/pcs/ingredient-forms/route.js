import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllIngredientForms,
  getFormsForIngredient,
  createIngredientForm,
} from '@/lib/pcs-ingredient-forms';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/ingredient-forms' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const ingredientId = searchParams.get('ingredientId');
  const rows = ingredientId
    ? await getFormsForIngredient(ingredientId)
    : await getAllIngredientForms();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/ingredient-forms' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.formName) {
    return NextResponse.json({ error: 'formName is required' }, { status: 400 });
  }
  const row = await createIngredientForm(fields);
  return NextResponse.json(row, { status: 201 });
}
