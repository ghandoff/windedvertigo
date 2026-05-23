import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getFormulaLine,
  updateFormulaLineField,
  isEditableFormulaLineField,
  FORMULA_LINE_EDITABLE_FIELDS,
} from '@/lib/pcs-formula-lines';
import { AI_UNITS } from '@/lib/pcs-config';

/**
 * GET /api/pcs/formula-lines/[id]
 * PATCH /api/pcs/formula-lines/[id]
 *
 * Living View Table 2 inline editing. PATCH routes through
 * `updateFormulaLineField` so every change lands a PCS Revisions audit row.
 *
 * Body: { fieldPath: string, value: any }
 * Guarded by `pcs.taxonomy:edit`.
 */

export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', {
    route: '/api/pcs/formula-lines/[id]',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const line = await getFormulaLine(id);
    return NextResponse.json(line);
  } catch (err) {
    console.error('Formula line GET error:', err);
    return NextResponse.json({ error: 'Formula line not found' }, { status: 404 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', {
    route: '/api/pcs/formula-lines/[id]',
  });
  if (auth.error) return auth.error;

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { fieldPath, value, reason } = body || {};
  if (!fieldPath || typeof fieldPath !== 'string') {
    return NextResponse.json({ error: 'fieldPath is required.' }, { status: 400 });
  }
  if (!isEditableFormulaLineField(fieldPath)) {
    return NextResponse.json(
      { error: `fieldPath "${fieldPath}" is not editable.`, allowed: FORMULA_LINE_EDITABLE_FIELDS },
      { status: 400 }
    );
  }

  // Validate enum fields
  if (fieldPath === 'amountUnit' && value != null && !AI_UNITS.includes(value)) {
    return NextResponse.json({ error: `Invalid amountUnit: ${value}` }, { status: 400 });
  }

  // Numeric fields — coerce strings to numbers, reject non-numeric
  if ((fieldPath === 'amountPerServing' || fieldPath === 'percentDailyValue' || fieldPath === 'elementalAmountMg') && value != null) {
    const n = Number(value);
    if (isNaN(n)) {
      return NextResponse.json({ error: `${fieldPath} must be a number` }, { status: 400 });
    }
  }

  try {
    const actor = auth.user?.email || request.headers.get('x-user-email') || 'unknown';
    const updated = await updateFormulaLineField({ id, fieldPath, value, actor, reason });
    return NextResponse.json(updated);
  } catch (err) {
    if (err.code === 'field-not-allowed') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Formula line PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update formula line' }, { status: 500 });
  }
}
