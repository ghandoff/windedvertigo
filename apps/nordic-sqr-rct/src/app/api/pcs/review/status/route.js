/**
 * GET /api/pcs/review/status?recordId=X&recordType=Y
 *
 * Returns the current gate status for a single record, derived from
 * the append-only review event log. Used by detail pages to show the
 * ReviewStatusBadge without re-fetching the full audit history.
 *
 * Returns null when the record has no review history yet.
 *
 * Auth: requires pcs.review:approve (expert roles only — the status
 * badge is only shown to team members who can also act on it).
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability.js';
import { getRecordGateStatus } from '@/lib/pcs-review-events.js';

export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'GET /api/pcs/review/status',
  });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');
  const recordType = searchParams.get('recordType');

  if (!recordId || !recordType) {
    return NextResponse.json(
      { error: 'missing-params', required: ['recordId', 'recordType'] },
      { status: 400 }
    );
  }

  const status = await getRecordGateStatus(recordId, recordType);
  return NextResponse.json({ status });
}
