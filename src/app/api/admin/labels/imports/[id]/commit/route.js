import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getIntakeRow, updateIntakeRow } from '@/lib/label-intake-queue';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/labels/imports/[id]/commit
 *
 * Wave 5.3 — operator-triggered commit. Accepts an optional JSON body with
 * { sku, pcsId, productName, regulatory, market } so the admin UI can write
 * operator-edited values before the cron picks the row up. Status is flipped
 * to `Pending` so the worker will extract + commit on the next tick.
 *
 * This endpoint does NOT run extraction synchronously — that's the worker's
 * job. It's just the "arm this row for processing" action. The existing PCS
 * importer uses a retry/cancel pattern; here it's commit/cancel because the
 * operator must manually OK each row (Gina's 20-label flow).
 */
export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/admin/labels/imports/[id]/commit' });
  if (auth.error) return auth.error;

  const { id } = await params;

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — operator may have filled SKU/PCS ID earlier.
  }

  try {
    const row = await getIntakeRow(id);
    if (row.status === 'Committed') {
      return NextResponse.json(
        { error: 'Row already committed.' },
        { status: 409 },
      );
    }
    if (row.status === 'Extracting') {
      return NextResponse.json(
        { error: 'Row is currently being processed by the worker.' },
        { status: 409 },
      );
    }

    const fields = { status: 'Pending', error: '' };
    if (typeof body.sku === 'string') fields.sku = body.sku.trim();
    if (typeof body.pcsId === 'string') fields.pcsId = body.pcsId.trim();
    if (typeof body.productName === 'string') fields.productName = body.productName.trim();
    if (typeof body.regulatory === 'string' && body.regulatory) fields.regulatory = body.regulatory;
    if (typeof body.market === 'string') fields.market = body.market.trim();

    // Wave 5.3.1: no pre-extraction SKU/PCS gate. Extraction runs on any Pending
    // row and fills SKU from the label. To move OFF `Needs Validation` (i.e.
    // re-queue a row that already extracted but lacked a PCS link), the operator
    // must supply a PCS ID — otherwise the row will just bounce back.
    const effectivePcsId = fields.pcsId ?? row.pcsId;
    if (row.status === 'Needs Validation' && !effectivePcsId) {
      return NextResponse.json(
        { error: 'Add a PCS ID before re-queueing a Needs Validation row.' },
        { status: 400 },
      );
    }

    const updated = await updateIntakeRow(id, fields);
    return NextResponse.json({
      ok: true,
      row: { ...updated, extractionData: updated.extractionData ? `[${updated.extractionData.length} chars]` : '' },
    });
  } catch (err) {
    console.error('Label intake commit failed:', err);
    return NextResponse.json(
      { error: 'Commit failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}
