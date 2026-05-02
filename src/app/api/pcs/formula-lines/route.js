import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllFormulaLines, getFormulaLinesForVersion, createFormulaLine,
} from '@/lib/pcs-formula-lines';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/formula-lines' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('versionId');

  const lines = versionId
    ? await getFormulaLinesForVersion(versionId)
    : await getAllFormulaLines();
  return NextResponse.json(lines);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/formula-lines' });
  if (auth.error) return auth.error;

  const fields = await request.json();
  if (!fields.ingredientForm) {
    return NextResponse.json({ error: 'ingredientForm is required' }, { status: 400 });
  }
  const line = await createFormulaLine(fields);
  return NextResponse.json(line, { status: 201 });
}
