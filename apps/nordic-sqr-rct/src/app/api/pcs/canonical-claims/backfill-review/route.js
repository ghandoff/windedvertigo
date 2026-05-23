/**
 * /api/pcs/canonical-claims/backfill-review — Phase 4.6 Bundle B.2
 *
 * GET — list every PCS Claim with its proposed canonical/prefix/benefit
 *       mapping (live-derived from Notion via the regex matcher).
 *       Optional ?status=applied|pending-high|pending-low|unmatchable filter.
 *
 * POST — approve a single proposal: write the Canonical Claim, Claim prefix,
 *       and Core benefit relations to the PCS Claim, and create primary +
 *       secondary Wording Variant rows.
 *
 *       Body: { pcsClaimId, canonicalClaimId, claimPrefixId, coreBenefitIds, variants }
 *
 * Capability: pcs.canonical:edit (researcher / RA / admin / super-user).
 *
 * Cache strategy (two layers):
 *   1. In-memory: zero-latency within the same serverless instance lifetime.
 *   2. Supabase (pcs_backfill_proposals_cache, singleton row): survives cold
 *      starts.  A new instance checks Supabase first; if the row is < 5 min
 *      old it returns immediately and avoids ~15-25s of Notion scanning.
 *      Falls back to a full Notion rebuild when Supabase is unavailable or
 *      the row is stale.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getMatchingProposals, filterProposals } from '@/lib/canonical-claim-matcher';
import { updateClaim } from '@/lib/pcs-claims';
import { getCanonicalClaim } from '@/lib/pcs-canonical-claims';
import { notion } from '@/lib/notion';
import { PCS_DB, PROPS } from '@/lib/pcs-config';
import { getPcsSupabase } from '@/lib/supabase-pcs';

// ── Layer 1: in-memory cache ────────────────────────────────────────────────
// Rebuilt every MEM_TTL_MS within the same CF Workers isolate lifetime.
// NOTE: Cloudflare Workers creates a new isolate per request, so _cache is
// always null on a cold start — the Supabase layer is the real persistent cache.
let _cache = null;
let _cacheBuiltAt = 0;
let _inflight = null;
const MEM_TTL_MS = 5 * 60 * 1000;  // 5 min  — in-memory (same isolate only)
const SB_TTL_MS  = 30 * 60 * 1000; // 30 min — Supabase (survives cold starts)
const SB_TABLE = 'pcs_backfill_proposals_cache';
const SB_ROW_ID = 'singleton';

// ── Layer 2: Supabase helpers ───────────────────────────────────────────────

/** Read from Supabase. Returns { proposals, builtAt } or null. */
async function readSbCache() {
  const sb = getPcsSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from(SB_TABLE)
      .select('proposals, built_at')
      .eq('id', SB_ROW_ID)
      .maybeSingle();
    if (error || !data) return null;
    return { proposals: data.proposals, builtAt: new Date(data.built_at).getTime() };
  } catch {
    return null;
  }
}

/** Write proposals to Supabase (fire-and-forget; failures are soft). */
async function writeSbCache(proposals) {
  const sb = getPcsSupabase();
  if (!sb) return;
  try {
    await sb.from(SB_TABLE).upsert(
      { id: SB_ROW_ID, proposals, built_at: new Date().toISOString(), notion_count: proposals.length },
      { onConflict: 'id' },
    );
  } catch (err) {
    console.warn('[backfill-review] Supabase cache write failed (non-fatal):', err?.message);
  }
}

/** Delete the Supabase singleton row (called on manual cache invalidation). */
async function deleteSbCache() {
  const sb = getPcsSupabase();
  if (!sb) return;
  try {
    await sb.from(SB_TABLE).delete().eq('id', SB_ROW_ID);
  } catch (err) {
    console.warn('[backfill-review] Supabase cache delete failed (non-fatal):', err?.message);
  }
}

// ── getProposalsCached ──────────────────────────────────────────────────────

async function getProposalsCached() {
  // Fast path: in-memory hit (same CF Workers isolate, within TTL)
  if (_cache && Date.now() - _cacheBuiltAt < MEM_TTL_MS) return _cache;

  // Single-flight: concurrent requests share one in-progress Promise
  if (_inflight) return _inflight;

  // Cold-start: check Supabase before triggering full Notion rebuild.
  // SB_TTL_MS (30 min) >> MEM_TTL_MS (5 min) so that cold-start isolates
  // reuse the cached scan for up to 30 min without hitting Notion again.
  const sbRow = await readSbCache();
  if (sbRow && Date.now() - sbRow.builtAt < SB_TTL_MS) {
    _cache = sbRow.proposals;
    _cacheBuiltAt = sbRow.builtAt;
    return _cache;
  }

  // Full rebuild from Notion — await the Supabase write before returning so
  // CF Workers cannot cancel it when the isolate ends after the response.
  _inflight = getMatchingProposals()
    .then(async (proposals) => {
      _cache = proposals;
      _cacheBuiltAt = Date.now();
      _inflight = null;
      await writeSbCache(proposals); // await ensures write completes before isolate exit
      return proposals;
    })
    .catch((err) => {
      _inflight = null;
      throw err;
    });
  return _inflight;
}

function invalidateCache() {
  _cache = null;
  _cacheBuiltAt = 0;
  // Do not reset _inflight — an in-progress rebuild should still complete.
  // Also clear the Supabase row so the next cold-start triggers a fresh build.
  deleteSbCache();
}

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.canonical:edit', {
    route: '/api/pcs/canonical-claims/backfill-review',
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const minConf = parseFloat(searchParams.get('min') || '0');

  try {
    const all = await getProposalsCached();
    const filtered = status ? filterProposals(all, status, minConf) : all;
    return NextResponse.json({
      proposals: filtered,
      stats: {
        total: all.length,
        applied: all.filter((p) => p.currentCanonicalId).length,
        pendingHigh: all.filter((p) => !p.currentCanonicalId && p.confidence >= 0.7).length,
        pendingLow: all.filter((p) => !p.currentCanonicalId && p.confidence < 0.7 && p.proposedCanonical).length,
        unmatchable: all.filter((p) => !p.currentCanonicalId && !p.proposedCanonical).length,
      },
      cacheBuiltAt: new Date(_cacheBuiltAt).toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'failed to derive proposals' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.canonical:edit', {
    route: '/api/pcs/canonical-claims/backfill-review',
  });
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
  }

  const { pcsClaimId, canonicalClaimId, claimPrefixId, coreBenefitIds, variants } = body || {};
  if (!pcsClaimId) {
    return NextResponse.json({ error: 'pcsClaimId required' }, { status: 400 });
  }

  try {
    // 1) Write relations on the PCS claim row.
    const claimFields = {};
    if (canonicalClaimId !== undefined) claimFields.canonicalClaimId = canonicalClaimId || null;
    if (claimPrefixId !== undefined) claimFields.claimPrefixId = claimPrefixId || null;
    if (coreBenefitIds !== undefined && coreBenefitIds.length > 0) {
      // PCS Claims has only one core_benefit relation; pick the first
      claimFields.coreBenefitId = coreBenefitIds[0] || null;
    }
    const updated = await updateClaim(pcsClaimId, claimFields);

    // 2) Standardize claim text to canonical wording + create version log.
    //
    // When a canonical claim is linked we fetch its authoritative text and:
    //   a) Overwrite the PCS claim's free-text `claim` field with that wording.
    //   b) Create two Wording Variant rows as a permanent version log:
    //        • isPrimary=true  → canonical standardized text
    //        • isPrimary=false → original pre-standardization text
    //
    // Both variant rows are created even when the texts match so the audit
    // trail is complete. Variant creation is soft-failed per-row.

    let variantsCreated = 0;
    let standardized = false;
    const originalText = updated?.claim || '';

    if (canonicalClaimId && PCS_DB.wordingVariants) {
      const VP = PROPS.wordingVariants;

      // Fetch canonical text (Postgres mirror first, Notion fallback).
      let canonicalText = null;
      try {
        const canonical = await getCanonicalClaim(canonicalClaimId);
        canonicalText = canonical?.canonicalClaim || null;
      } catch (err) {
        console.warn('[backfill-review] failed to fetch canonical claim text (non-fatal):', err?.message);
      }

      if (canonicalText) {
        // a) Update the PCS claim text to the canonical wording.
        if (originalText !== canonicalText) {
          try {
            await updateClaim(pcsClaimId, { claim: canonicalText });
            standardized = true;
          } catch (err) {
            console.warn('[backfill-review] failed to standardize claim text (non-fatal):', err?.message);
          }
        }

        // b) Version log: primary = canonical text, secondary = original text.
        const versionRows = [
          {
            wording: canonicalText,
            isPrimary: true,
            notes: 'Canonical — standardized via backfill-review.',
          },
          ...(originalText && originalText !== canonicalText
            ? [{
                wording: originalText,
                isPrimary: false,
                notes: 'Original pre-standardization text.',
              }]
            : []),
        ];

        for (const row of versionRows) {
          try {
            await notion.pages.create({
              parent: { database_id: PCS_DB.wordingVariants },
              properties: {
                [VP.wording]: { title: [{ text: { content: row.wording.slice(0, 1990) } }] },
                [VP.pcsClaim]: { relation: [{ id: pcsClaimId }] },
                [VP.isPrimary]: { checkbox: row.isPrimary },
                [VP.variantNotes]: { rich_text: [{ text: { content: row.notes } }] },
              },
            });
            variantsCreated++;
          } catch (err) {
            console.error('[backfill-review] failed to create wording variant:', err?.message);
          }
        }
      }
    }

    // 3) Additional user-supplied wording variants (if provided separately).
    if (Array.isArray(variants) && variants.length > 0 && PCS_DB.wordingVariants) {
      const VP = PROPS.wordingVariants;
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const wording = typeof v === 'string' ? v : v?.wording;
        if (!wording) continue;
        try {
          await notion.pages.create({
            parent: { database_id: PCS_DB.wordingVariants },
            properties: {
              [VP.wording]: { title: [{ text: { content: wording.slice(0, 1990) } }] },
              [VP.pcsClaim]: { relation: [{ id: pcsClaimId }] },
              [VP.isPrimary]: { checkbox: false },
              [VP.variantNotes]: { rich_text: [{ text: { content: `User-supplied variant ${i + 1}/${variants.length} (backfill-review).` } }] },
            },
          });
          variantsCreated++;
        } catch (err) {
          console.error('[backfill-review] failed to create user variant:', err?.message);
        }
      }
    }

    invalidateCache();
    return NextResponse.json({
      ok: true,
      pcsClaim: updated,
      variantsCreated,
      standardized,
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'approval failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await requireCapability(request, 'pcs.canonical:edit', {
    route: '/api/pcs/canonical-claims/backfill-review',
  });
  if (auth.error) return auth.error;
  invalidateCache();
  return NextResponse.json({ ok: true, cacheCleared: true });
}
