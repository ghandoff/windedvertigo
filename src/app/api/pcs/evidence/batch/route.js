import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { createEvidence } from '@/lib/pcs-evidence';
import { EVIDENCE_TYPES } from '@/lib/pcs-config';

export const maxDuration = 300;

const delay = ms => new Promise(r => setTimeout(r, ms));

export async function POST(request) {
  const { user, error } = await requireCapability(request, 'pcs.evidence:attach', { route: '/api/pcs/evidence/batch' });
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { items } = body;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
  }

  if (items.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 items per batch' }, { status: 400 });
  }

  const created = [];
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.name || typeof item.name !== 'string') {
      errors.push({ index: i, name: item.name || null, error: 'name is required' });
      continue;
    }

    if (item.evidenceType && !EVIDENCE_TYPES.includes(item.evidenceType)) {
      errors.push({ index: i, name: item.name, error: `Invalid evidenceType: ${item.evidenceType}` });
      continue;
    }

    try {
      const result = await createEvidence(item);
      created.push({ id: result.id, name: result.name });
    } catch (err) {
      errors.push({ index: i, name: item.name, error: err.message });
    }

    if (i < items.length - 1) {
      await delay(350);
    }
  }

  return NextResponse.json({ created, errors });
}
