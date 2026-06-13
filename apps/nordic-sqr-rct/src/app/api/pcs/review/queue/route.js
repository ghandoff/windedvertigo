/**
 * GET /api/pcs/review/queue
 *
 * Returns items pending expert review for the current user. Filterable by
 * record type and confidence band.
 *
 * In the current preview this returns a structure description (no live data
 * store yet). The response shape is the authoritative contract for the UI.
 *
 * Query params:
 *   ?type=claim|evidence|pcs-document|canonical-claim|dossier
 *   ?confidence=low|medium|high   (low=<0.5, medium=0.5–0.8, high=>0.8)
 *   ?limit=50
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability.js';

export const revalidate = 0;

export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.review:approve', {
    route: 'GET /api/pcs/review/queue',
  });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? null;
  const confidence = searchParams.get('confidence') ?? null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  return NextResponse.json({
    items: [],
    total: 0,
    filters: { type, confidence, limit },
    _note: 'Review queue data store not yet connected. This endpoint shape is the authoritative contract. Items will be populated once the review_events table is provisioned.',
  });
}
