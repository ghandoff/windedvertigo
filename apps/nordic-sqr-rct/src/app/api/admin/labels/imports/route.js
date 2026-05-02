import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getAllIntakeRows,
  getIntakeRowsByStatus,
  getIntakeRowsByBatch,
} from '@/lib/label-intake-queue';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/labels/imports
 *
 * Wave 5.3 — list Label Intake Queue rows, optionally filtered by status or
 * batchId. Strips the (potentially large) extractionData field from list
 * responses; fetch an individual row to see full extraction JSON.
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/admin/labels/imports' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const batchId = searchParams.get('batchId');
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw && /^\d+$/.test(limitRaw) ? Number(limitRaw) : 100;

  try {
    let rows;
    if (batchId) {
      rows = await getIntakeRowsByBatch(batchId);
    } else if (status) {
      rows = await getIntakeRowsByStatus(status, limit);
    } else {
      rows = await getAllIntakeRows();
      rows = rows.slice(0, limit);
    }
    const stripped = rows.map(r => ({
      ...r,
      extractionData: r.extractionData ? `[${r.extractionData.length} chars]` : '',
    }));
    return NextResponse.json({ rows: stripped });
  } catch (err) {
    console.error('List label imports failed:', err);
    return NextResponse.json(
      { error: 'List failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}
