import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getIngredient,
  updateIngredient,
  deleteIngredient,
} from '@/lib/pcs-ingredients';
import { AI_CATEGORIES, AI_UNITS } from '@/lib/pcs-config';

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/ingredients/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await getIngredient(id);
  return NextResponse.json(row);
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/ingredients/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  const fields = await request.json();
  if (fields.category && !AI_CATEGORIES.includes(fields.category)) {
    return NextResponse.json({ error: `Invalid category: ${fields.category}` }, { status: 400 });
  }
  if (fields.standardUnit && !AI_UNITS.includes(fields.standardUnit)) {
    return NextResponse.json({ error: `Invalid standardUnit: ${fields.standardUnit}` }, { status: 400 });
  }
  if (fields.fdaRdiUnit && !AI_UNITS.includes(fields.fdaRdiUnit)) {
    return NextResponse.json({ error: `Invalid fdaRdiUnit: ${fields.fdaRdiUnit}` }, { status: 400 });
  }
  const row = await updateIngredient(id, fields);
  return NextResponse.json(row);
}

export async function DELETE(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/ingredients/[id]' });
  if (auth.error) return auth.error;
  const { id } = await params;
  await deleteIngredient(id);
  return NextResponse.json({ ok: true });
}
