import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllIngredients, createIngredient } from '@/lib/pcs-ingredients';
import { AI_CATEGORIES, AI_UNITS } from '@/lib/pcs-config';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/ingredients' });
  if (auth.error) return auth.error;
  const rows = await getAllIngredients();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/ingredients' });
  if (auth.error) return auth.error;

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
  if (!fields.canonicalName) {
    return NextResponse.json({ error: 'canonicalName is required' }, { status: 400 });
  }
  const row = await createIngredient(fields);
  return NextResponse.json(row, { status: 201 });
}
