import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllPrefixes, createPrefix } from '@/lib/pcs-prefixes';
import { REGULATORY_TIERS } from '@/lib/pcs-config';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:read', { route: '/api/pcs/prefixes' });
  if (auth.error) return auth.error;
  const rows = await getAllPrefixes();
  return NextResponse.json(rows);
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', { route: '/api/pcs/prefixes' });
  if (auth.error) return auth.error;
  const fields = await request.json();
  if (fields.regulatoryTier && !REGULATORY_TIERS.includes(fields.regulatoryTier)) {
    return NextResponse.json({ error: `Invalid regulatoryTier: ${fields.regulatoryTier}` }, { status: 400 });
  }
  const row = await createPrefix(fields);
  return NextResponse.json(row, { status: 201 });
}
