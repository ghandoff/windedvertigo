import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getIntakeRow } from '@/lib/label-intake-queue';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/labels/imports/[id]
 *
 * Return a single Label Intake Queue row with full extractionData (un-stripped).
 */
export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/admin/labels/imports/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const row = await getIntakeRow(id);
    return NextResponse.json({ row });
  } catch (err) {
    console.error('Fetch label intake row failed:', err);
    return NextResponse.json(
      { error: 'Fetch failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}
