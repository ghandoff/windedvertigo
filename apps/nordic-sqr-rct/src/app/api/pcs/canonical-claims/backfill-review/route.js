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
 * Notion-primary throughout. No Supabase coupling for runtime.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getMatchingProposals, filterProposals } from '@/lib/canonical-claim-matcher';
import { updateClaim } from '@/lib/pcs-claims';
import { notion } from '@/lib/notion';
import { PCS_DB, PROPS } from '@/lib/pcs-config';

// In-memory cache of the proposal list. Rebuilt every CACHE_TTL_MS.
// Live derivation from Notion is ~15-25s for 469 PCS claims; caching makes
// the review UI snappy without losing freshness.
let _cache = null;
let _cacheBuiltAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function getProposalsCached() {
  if (_cache && Date.now() - _cacheBuiltAt < CACHE_TTL_MS) return _cache;
  _cache = await getMatchingProposals();
  _cacheBuiltAt = Date.now();
  return _cache;
}

function invalidateCache() {
  _cache = null;
  _cacheBuiltAt = 0;
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
    const fields = {};
    if (canonicalClaimId !== undefined) fields.canonicalClaimId = canonicalClaimId || null;
    if (claimPrefixId !== undefined) fields.claimPrefixId = claimPrefixId || null;
    if (coreBenefitIds !== undefined && coreBenefitIds.length > 0) {
      // PCS Claims has only one core_benefit relation; pick the first
      fields.coreBenefitId = coreBenefitIds[0] || null;
    }
    const updated = await updateClaim(pcsClaimId, fields);

    // 2) Create Wording Variant rows (only if variants array provided + non-empty).
    let variantsCreated = 0;
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
              [VP.isPrimary]: { checkbox: i === 0 },
              ...(variants.length > 1
                ? { [VP.variantNotes]: { rich_text: [{ text: { content: `Approved via backfill-review. Variant ${i + 1}/${variants.length}.` } }] } }
                : {}),
            },
          });
          variantsCreated++;
        } catch (err) {
          // Soft-fail per variant; partial success is fine
          console.error('[backfill-review] failed to create variant:', err?.message);
        }
      }
    }

    invalidateCache();
    return NextResponse.json({
      ok: true,
      pcsClaim: updated,
      variantsCreated,
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
