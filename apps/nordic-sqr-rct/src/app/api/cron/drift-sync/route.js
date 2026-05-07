import { NextResponse } from 'next/server';
import { syncRecentEvidenceToPostgres } from '@/lib/pcs-evidence';
import { syncRecentClaimsToPostgres } from '@/lib/pcs-claims';
import { syncRecentDocumentsToPostgres } from '@/lib/pcs-documents';
import { syncRecentEvidencePacketsToPostgres } from '@/lib/pcs-evidence-packets';
import { syncRecentCanonicalClaimsToPostgres } from '@/lib/pcs-canonical-claims';
import { syncRecentIngredientsToPostgres } from '@/lib/pcs-ingredients';
import { syncRecentCoreBenefitsToPostgres } from '@/lib/pcs-core-benefits';
import { getPcsSupabase } from '@/lib/supabase-pcs';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/drift-sync
 *
 * Vercel Cron entry point for the Path-2 Phase A drift catcher.
 *
 * Runs every 2 minutes and pulls direct-Notion edits (i.e. Sharon
 * editing a row in Notion's web UI, bypassing our platform's write
 * paths) into Postgres. Uses each table's MAX(notion_last_edited_at)
 * as the watermark, with a 5-minute overlap window to absorb
 * clock-skew between Notion and Postgres.
 *
 * In-platform writes already mirror via mirrorToPostgres() inside
 * createX/updateX — this cron exists specifically to catch the gap
 * where the team edits Notion directly without going through the
 * platform.
 *
 * Authenticated via CRON_SECRET bearer token (Vercel injects this
 * on scheduled cron requests; manual invocations need to send it
 * explicitly).
 */
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getPcsSupabase();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 },
    );
  }

  const tables = [
    { name: 'pcs_evidence', sync: syncRecentEvidenceToPostgres },
    { name: 'pcs_claims', sync: syncRecentClaimsToPostgres },
    { name: 'pcs_documents', sync: syncRecentDocumentsToPostgres },
    { name: 'pcs_evidence_packets', sync: syncRecentEvidencePacketsToPostgres },
    { name: 'pcs_canonical_claims', sync: syncRecentCanonicalClaimsToPostgres },
    { name: 'pcs_ingredients', sync: syncRecentIngredientsToPostgres },
    { name: 'pcs_core_benefits', sync: syncRecentCoreBenefitsToPostgres },
  ];

  // 5-minute overlap window so we don't miss edits that landed during
  // the previous run (Notion's last_edited_time updates can lag a few
  // seconds, and our clock and theirs aren't perfectly aligned).
  const OVERLAP_MS = 5 * 60 * 1000;
  const start = Date.now();
  const results = [];

  for (const { name, sync } of tables) {
    const tableStart = Date.now();
    try {
      // Get current max watermark from Postgres
      const { data: maxRow, error: maxErr } = await sb
        .from(name)
        .select('notion_last_edited_at')
        .order('notion_last_edited_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxErr) throw maxErr;

      // Default to 1 hour ago on first run (no rows yet, or first sync)
      const fallback = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const maxAt = maxRow?.notion_last_edited_at || fallback;

      // Subtract overlap to absorb clock skew
      const sinceIso = new Date(new Date(maxAt).getTime() - OVERLAP_MS).toISOString();

      const r = await sync(sinceIso);
      results.push({
        table: name,
        sinceIso,
        fetched: r.fetched,
        mirrored: r.count,
        maxSeen: r.maxSeen,
        durationMs: Date.now() - tableStart,
      });
    } catch (err) {
      console.error(`[cron:drift-sync] ${name} failed:`, err.message);
      results.push({
        table: name,
        error: err.message,
        durationMs: Date.now() - tableStart,
      });
    }
  }

  const totalMirrored = results.reduce((s, r) => s + (r.mirrored || 0), 0);
  if (totalMirrored > 0) {
    console.log(
      `[cron:drift-sync] mirrored ${totalMirrored} rows in ${Date.now() - start}ms`,
    );
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    totalMirrored,
    results,
  });
}
