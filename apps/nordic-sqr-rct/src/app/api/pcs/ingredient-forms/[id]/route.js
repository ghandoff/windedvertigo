import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getIngredientForm,
  updateIngredientForm,
  deleteIngredientForm,
} from '@/lib/pcs-ingredient-forms';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/ingredient-forms/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await getIngredientForm(id);
  return NextResponse.json(row);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/ingredient-forms/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const fields = await request.json();
  const row = await updateIngredientForm(id, fields);
  return NextResponse.json(row);
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/ingredient-forms/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  await deleteIngredientForm(id);
  return NextResponse.json({ ok: true });
}
