import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getJob } from '@/lib/pcs-import-jobs';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/imports/[id]
 * Returns the full job record, including the reassembled extractedData JSON.
 */
export async function GET(request, { params }) {
  const auth = await requireCapability(request, 'pcs.imports:cancel', { route: '/api/admin/imports/[id]' });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const job = await getJob(id);
    return NextResponse.json({ job });
  } catch (err) {
    console.error('Get import failed:', err);
    return NextResponse.json(
      { error: 'Not found', message: err?.message || String(err) },
      { status: 404 },
    );
  }
}
