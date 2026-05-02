import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  createIntakeRow,
  getIntakeRowByContentHash,
} from '@/lib/label-intake-queue';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/labels/imports/stage
 *
 * Wave 5.3 — accepts already-uploaded label file URLs (Blob) and creates
 * Label Intake Queue rows in `Pending` state. The browser uploaded each file
 * direct to Blob via /api/admin/labels/imports/upload-token (raw XHR); this
 * route only does Notion dedup + row creation.
 *
 * Body:
 *   {
 *     uploads: [{ url, filename, size, contentHash, sku?, pcsId?, productName?, regulatory?, market? }, ...]
 *   }
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/admin/labels/imports/stage' });
  if (auth.error) return auth.error;
  const user = auth.user;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid JSON body', message: err?.message || String(err) },
      { status: 400 },
    );
  }

  const uploads = Array.isArray(body?.uploads) ? body.uploads : [];
  if (uploads.length === 0) {
    return NextResponse.json({ error: 'No uploads provided' }, { status: 400 });
  }
  for (const [i, u] of uploads.entries()) {
    if (!u || typeof u !== 'object') {
      return NextResponse.json({ error: `uploads[${i}] is not an object` }, { status: 400 });
    }
    if (typeof u.url !== 'string' || !u.url) {
      return NextResponse.json({ error: `uploads[${i}].url missing` }, { status: 400 });
    }
    if (typeof u.filename !== 'string' || !u.filename) {
      return NextResponse.json({ error: `uploads[${i}].filename missing` }, { status: 400 });
    }
    if (typeof u.contentHash !== 'string' || !u.contentHash) {
      return NextResponse.json({ error: `uploads[${i}].contentHash missing` }, { status: 400 });
    }
  }

  const batchId = `LB${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const rows = [];
  const counts = { pending: 0, duplicate: 0, errored: 0 };

  const processUpload = async (upload) => {
    const { url, filename, contentHash, sku, pcsId, productName, regulatory, market } = upload;
    try {
      // Dedup by content hash — if an earlier intake row has the same hash
      // (in any non-Cancelled state), report it as duplicate without creating
      // another row.
      let dupMatch = null;
      try {
        dupMatch = await getIntakeRowByContentHash(contentHash);
      } catch (dupErr) {
        console.warn('Label intake dedup query failed:', dupErr?.message || dupErr);
      }
      if (dupMatch) {
        counts.duplicate++;
        rows.push({
          filename,
          status: 'duplicate',
          duplicate: {
            priorRowId: dupMatch.id,
            priorBatchId: dupMatch.batchId,
            priorSku: dupMatch.sku,
            priorStatus: dupMatch.status,
          },
        });
        return;
      }

      const created = await createIntakeRow({
        sku: sku || '',
        pcsId: pcsId || null,
        productName: productName || null,
        labelFile: { url, name: filename },
        batchId,
        ownerEmail: user.email || null,
        contentHash,
        regulatory: regulatory || null,
        market: market || null,
        initialStatus: 'Pending',
      });

      counts.pending++;
      rows.push({
        id: created.id,
        sku: created.sku,
        pcsId: created.pcsId,
        filename,
        status: created.status,
      });
    } catch (err) {
      counts.errored++;
      rows.push({ filename, status: 'errored', error: err?.message || String(err) });
      console.error(`Label intake stage failed for ${filename}:`, err);
    }
  };

  await Promise.all(uploads.map(u => processUpload(u)));

  return NextResponse.json({ batchId, rows, counts });
}
