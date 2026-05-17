/**
 * POST /api/pcs/evidence/backfill-pdf-analytics
 *
 * Admin endpoint. Stamps publisher_cost_usd on all existing evidence rows
 * using estimatePublisherCost(doi). Does NOT set pdf_platform_retrieved=true —
 * we can't retroactively determine if the waterfall retrieved them.
 *
 * Run once after the migration to populate cost data for existing articles.
 * Idempotent — safe to run multiple times; only updates rows where the
 * computed cost differs from the current value.
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

  const { data: rows, error: fetchErr } = await sb
    .from('pcs_evidence')
    .select('id, doi, publisher_cost_usd');

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  let updated = 0;
  const errors = [];
  for (const row of rows || []) {
    const cost = estimatePublisherCost(row.doi);
    if (Number(row.publisher_cost_usd) === cost) continue;
    const { error: upErr } = await sb
      .from('pcs_evidence')
      .update({ publisher_cost_usd: cost })
      .eq('id', row.id);
    if (upErr) { errors.push(`${row.id}: ${upErr.message}`); continue; }
    updated++;
  }

  return NextResponse.json({ ok: true, updated, errors, total: rows?.length || 0 });
}
