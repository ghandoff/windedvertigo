import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getEvidence } from '@/lib/pcs-evidence';
import { feedToIntake, feedBatchToIntake } from '@/lib/pcs-intake-feed';

/**
 * POST /api/pcs/evidence/send-to-review
 *
 * Send one or more PCS evidence items to the SQR-RCT reviewer queue.
 * Creates intake entries in the SQR-RCT Intake DB for distributed review.
 *
 * Body: { id: string } — single item
 *   or: { ids: string[] } — batch (max 50)
 *
 * Returns: { result } or { results } with per-item status.
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.evidence:send-to-review', { route: '/api/pcs/evidence/send-to-review' });
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Single item
  if (body.id && !body.ids) {
    const evidence = await getEvidence(body.id);
    if (!evidence) {
      return NextResponse.json({ error: 'Evidence item not found' }, { status: 404 });
    }
    const result = await feedToIntake(evidence);
    return NextResponse.json({ result });
  }

  // Batch
  if (body.ids && Array.isArray(body.ids)) {
    if (body.ids.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 items per batch' }, { status: 400 });
    }
    const items = [];
    for (const id of body.ids) {
      const ev = await getEvidence(id);
      if (ev) items.push(ev);
    }
    const results = await feedBatchToIntake(items);
    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      duplicate: results.filter(r => r.status === 'duplicate').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    };
    return NextResponse.json({ results, summary });
  }

  return NextResponse.json({ error: 'Provide id (string) or ids (array)' }, { status: 400 });
}
