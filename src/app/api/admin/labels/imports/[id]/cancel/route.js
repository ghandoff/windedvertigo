import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getIntakeRow, updateIntakeRow } from '@/lib/label-intake-queue';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/labels/imports/[id]/cancel
 *
 * Flip a Pending / Needs Validation / Failed row to Cancelled so the worker
 * skips it. Refuses if the row is already Committed.
 */
export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/admin/labels/imports/[id]/cancel' });
  if (auth.error) return auth.error;
  const user = auth.user;

  const { id } = await params;
  try {
    const row = await getIntakeRow(id);
    if (row.status === 'Committed') {
      return NextResponse.json(
        { error: 'Cannot cancel — row already committed.' },
        { status: 409 },
      );
    }
    const updated = await updateIntakeRow(id, {
      status: 'Cancelled',
      error: `Cancelled by ${user.email || 'admin'} at ${new Date().toISOString()}`,
    });
    return NextResponse.json({ ok: true, row: updated });
  } catch (err) {
    console.error('Label intake cancel failed:', err);
    return NextResponse.json(
      { error: 'Cancel failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}
