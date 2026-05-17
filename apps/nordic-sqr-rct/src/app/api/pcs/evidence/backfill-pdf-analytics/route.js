/**
 * POST /api/pcs/evidence/backfill-pdf-analytics
 *
 * Admin endpoint. Two idempotent passes:
 *
 *   Pass 1 — publisher_cost_usd: stamps estimatePublisherCost(doi) on every
 *   row where the computed value differs from the stored value.
 *
 *   Pass 2 — pdf_platform_retrieved: marks TRUE on every row that has a
 *   pdf_url but pdf_platform_retrieved = false. Used when confirming that
 *   existing PDFs were retrieved by the platform waterfall (not manually
 *   uploaded). Pass 2 only runs when confirmPlatformRetrieved=true is
 *   included in the request body, so the caller must explicitly opt-in.
 *
 * Idempotent — safe to run multiple times.
 *
 * Capability: pcs.canonical:edit (researcher / RA / admin / super-user).
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getPcsSupabase } from '@/lib/supabase-pcs';
import { estimatePublisherCost } from '@/lib/pcs-evidence';

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.canonical:edit', {
    route: '/api/pcs/evidence/backfill-pdf-analytics',
  });
  if (auth.error) return auth.error;

  const sb = getPcsSupabase();
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body = {};
  try { body = await request.json(); } catch { /* body is optional */ }
  const { confirmPlatformRetrieved = false } = body;

  // Pass 1 — stamp publisher_cost_usd on all rows
  const { data: rows, error: fetchErr } = await sb
    .from('pcs_evidence')
    .select('id, doi, publisher_cost_usd');

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  let costUpdated = 0;
  const errors = [];
  for (const row of rows || []) {
    const cost = estimatePublisherCost(row.doi);
    if (Number(row.publisher_cost_usd) === cost) continue;
    const { error: upErr } = await sb
      .from('pcs_evidence')
      .update({ publisher_cost_usd: cost })
      .eq('id', row.id);
    if (upErr) { errors.push(`cost/${row.id}: ${upErr.message}`); continue; }
    costUpdated++;
  }

  // Pass 2 — mark platform-retrieved for rows with existing PDFs (opt-in)
  let platformRetrievedUpdated = 0;
  if (confirmPlatformRetrieved) {
    const { data: pdfRows, error: pdfFetchErr } = await sb
      .from('pcs_evidence')
      .select('id')
      .not('pdf_url', 'is', null)
      .neq('pdf_url', '')
      .eq('pdf_platform_retrieved', false);

    if (pdfFetchErr) {
      errors.push(`platform_retrieved_fetch: ${pdfFetchErr.message}`);
    } else {
      for (const row of pdfRows || []) {
        const { error: upErr } = await sb
          .from('pcs_evidence')
          .update({
            pdf_platform_retrieved: true,
            pdf_source: 'waterfall_backfill',
            pdf_retrieved_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (upErr) { errors.push(`platform_retrieved/${row.id}: ${upErr.message}`); continue; }
        platformRetrievedUpdated++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    costUpdated,
    platformRetrievedUpdated,
    errors,
    total: rows?.length || 0,
  });
}
