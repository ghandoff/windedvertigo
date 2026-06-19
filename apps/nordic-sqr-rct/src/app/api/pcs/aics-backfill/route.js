/**
 * /api/pcs/aics-backfill — Migration 022 / AICS-scoped Claim Backfill
 *
 * GET — returns PCS claims grouped by (ingredient × deduplicated text),
 *       each group annotated with the best-matching AICS claim proposal.
 *       Optional ?ingredient={name} to scope to one ingredient.
 *       Optional ?status=pending|low-confidence|unmatched|no-aics to filter.
 *
 * POST — batch-approve a group: writes matched_aics_claim_id +
 *        aics_match_confidence to ALL pcsClaimIds in one Supabase upsert.
 *        Body: { aicsClaimId, pcsClaimIds: string[], confidence: number }
 *
 * Capability: pcs.canonical:edit (researcher / RA / admin / super-user).
 *
 * Cache strategy: two-layer, identical to the legacy backfill-review route.
 *   1. In-memory (MEM_TTL_MS = 5 min) — same isolate lifetime.
 *   2. Supabase pcs_aics_backfill_cache singleton — survives cold starts,
 *      30-min TTL.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllClaims, updateClaim } from '@/lib/pcs-claims';
import { buildAicsBackfillGroups, buildConfirmedStats } from '@/lib/aics-claim-matcher';
import { getPcsSupabase } from '@/lib/supabase-pcs';

export const dynamic = 'force-dynamic';

// ── Layer 1: in-memory cache ────────────────────────────────────────────────
let _cache = null;
let _cacheBuiltAt = 0;
let _inflight = null;
const MEM_TTL_MS = 5 * 60 * 1000;
const SB_TTL_MS  = 30 * 60 * 1000;
const SB_TABLE = 'pcs_aics_backfill_cache';
const SB_ROW_ID = 'singleton';

// ── Layer 2: Supabase helpers ───────────────────────────────────────────────

async function readSbCache() {
  try {
    const sb = getPcsSupabase();
    const { data } = await sb
      .from(SB_TABLE)
      .select('groups, built_at, claim_count')
      .eq('id', SB_ROW_ID)
      .single();
    if (!data) return null;
    const age = Date.now() - new Date(data.built_at).getTime();
    if (age > SB_TTL_MS) return null;
    return { groups: data.groups, builtAt: data.built_at };
  } catch {
    return null;
  }
}

async function writeSbCache(groups) {
  try {
    const sb = getPcsSupabase();
    await sb.from(SB_TABLE).upsert({
      id: SB_ROW_ID,
      groups,
      built_at: new Date().toISOString(),
      claim_count: groups.reduce((n, g) => n + g.instances.length, 0),
    });
  } catch (err) {
    console.warn('[aics-backfill] Supabase cache write failed:', err?.message);
  }
}

async function invalidateSbCache() {
  try {
    const sb = getPcsSupabase();
    await sb.from(SB_TABLE).delete().eq('id', SB_ROW_ID);
  } catch {}
}

// ── Cache orchestration ─────────────────────────────────────────────────────

async function getGroups() {
  // Layer 1: in-memory
  if (_cache && Date.now() - _cacheBuiltAt < MEM_TTL_MS) return _cache;
  // Single-flight: concurrent requests share one rebuild Promise
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      // Layer 2: Supabase
      const sb = await readSbCache();
      if (sb) {
        _cache = sb.groups;
        _cacheBuiltAt = new Date(sb.builtAt).getTime();
        return _cache;
      }
      // Full rebuild
      const allClaims = await getAllClaims(100);
      const groups = await buildAicsBackfillGroups(allClaims);
      _cache = groups;
      _cacheBuiltAt = Date.now();
      writeSbCache(groups); // fire-and-forget
      return _cache;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

function invalidateCache() {
  _cache = null;
  _cacheBuiltAt = 0;
  invalidateSbCache();
}

// ── Stats helper ─────────────────────────────────────────────────────────────

function buildStats(groups, allClaims) {
  const { confirmedCount, total } = buildConfirmedStats(allClaims);
  const counts = { pending: 0, 'low-confidence': 0, unmatched: 0, 'no-aics': 0, 'no-ingredient': 0 };
  for (const g of groups) counts[g.status] = (counts[g.status] || 0) + 1;
  return { confirmed: confirmedCount, total, ...counts };
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const ingredientFilter = searchParams.get('ingredient');

  try {
    await requireCapability(request, 'pcs.canonical:edit');
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unauthorized' }, { status: 401 });
  }

  try {
    const [groups, allClaims] = await Promise.all([getGroups(), getAllClaims(100)]);

    let filtered = groups;
    if (statusFilter) filtered = filtered.filter(g => g.status === statusFilter);
    if (ingredientFilter) {
      const needle = ingredientFilter.toLowerCase();
      filtered = filtered.filter(g => (g.ingredientName || '').toLowerCase().includes(needle));
    }

    return NextResponse.json({
      groups: filtered,
      stats: buildStats(groups, allClaims),
      cacheBuiltAt: _cacheBuiltAt ? new Date(_cacheBuiltAt).toISOString() : null,
    });
  } catch (err) {
    console.error('[aics-backfill] GET error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request) {
  let user;
  try {
    user = await requireCapability(request, 'pcs.canonical:edit');
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { aicsClaimId, pcsClaimIds, confidence } = body;

  if (!Array.isArray(pcsClaimIds) || pcsClaimIds.length === 0) {
    return NextResponse.json({ error: 'pcsClaimIds must be a non-empty array' }, { status: 400 });
  }

  // "No match" decision: aicsClaimId null means reviewer confirmed there is
  // no matching AICS claim (compliance gap). We store matched_aics_claim_id
  // as the sentinel string 'NO_MATCH' so the claim leaves the review queue
  // and the gap is recorded.
  const matchedId = aicsClaimId || 'NO_MATCH';

  try {
    // Batch-update all claim instances at once
    const results = await Promise.allSettled(
      pcsClaimIds.map(id =>
        updateClaim(id, {
          matchedAicsClaimId: matchedId,
          aicsMatchConfidence: aicsClaimId ? (confidence ?? null) : null,
        }),
      ),
    );

    const failed = results
      .map((r, i) => r.status === 'rejected' ? { id: pcsClaimIds[i], reason: r.reason?.message } : null)
      .filter(Boolean);

    invalidateCache();

    return NextResponse.json({
      ok: true,
      updated: pcsClaimIds.length - failed.length,
      failed,
    });
  } catch (err) {
    console.error('[aics-backfill] POST error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

// ── DELETE (manual cache clear) ───────────────────────────────────────────────

export async function DELETE(request) {
  try {
    await requireCapability(request, 'pcs.canonical:edit');
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unauthorized' }, { status: 401 });
  }
  invalidateCache();
  return NextResponse.json({ ok: true, message: 'Cache cleared' });
}
