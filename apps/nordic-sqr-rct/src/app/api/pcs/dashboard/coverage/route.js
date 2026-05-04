/**
 * /api/pcs/dashboard/coverage — 2026-05-03 (perf split)
 *
 * Owns the ingredient × bucket coverage heatmap for the /pcs Command
 * Center. Split out from /api/pcs/dashboard because the heatmap depends
 * on a 1783-row Notion `evidence_packets` fetch that takes ~11s; keeping
 * it inline blocked first-page-load on every cold start.
 *
 * The /pcs page now lazy-loads this endpoint AFTER the KPI fetch resolves,
 * so KPIs paint in <3s and the heatmap fills in 5–10s later.
 *
 * Cache: 60s in-memory, same shape as the parent dashboard route.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllClaims } from '@/lib/pcs-claims';
import { getAllEvidence } from '@/lib/pcs-evidence';
import { getAllEvidencePackets } from '@/lib/pcs-evidence-packets';

let _cache = null;
let _cacheBuiltAt = 0;
const CACHE_TTL_MS = 60 * 1000;

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.claims:read', { route: '/api/pcs/dashboard/coverage' });
  if (auth.error) return auth.error;

  if (_cache && Date.now() - _cacheBuiltAt < CACHE_TTL_MS) {
    return NextResponse.json(_cache);
  }

  const [claims, evidence, packets] = await Promise.all([
    getAllClaims(),
    getAllEvidence(),
    getAllEvidencePackets(),
  ]);

  // Build lookups
  const claimBucketMap = {};
  for (const c of claims) claimBucketMap[c.id] = c.claimBucket || 'Unknown';
  const evidenceIngredientMap = {};
  for (const e of evidence) evidenceIngredientMap[e.id] = e.ingredient?.length ? e.ingredient : [];
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));

  const coverageCount = {};
  const coverageSqr = {};
  for (const p of packets) {
    const bucket = claimBucketMap[p.pcsClaimId] || 'Unknown';
    const ingredients = evidenceIngredientMap[p.evidenceItemId] || [];
    const item = evidenceById.get(p.evidenceItemId);
    for (const ing of ingredients) {
      if (!coverageCount[ing]) coverageCount[ing] = {};
      coverageCount[ing][bucket] = (coverageCount[ing][bucket] || 0) + 1;
      if (item?.sqrScore != null && item.sqrScore >= 0 && item.sqrScore <= 22) {
        if (!coverageSqr[ing]) coverageSqr[ing] = {};
        if (!coverageSqr[ing][bucket]) coverageSqr[ing][bucket] = [];
        coverageSqr[ing][bucket].push(item.sqrScore);
      }
    }
  }

  // Flatten heatmap rows
  const heatmapData = [];
  const allIngredients = [...new Set([
    ...Object.keys(coverageCount),
    ...evidence.flatMap((e) => e.ingredient || []),
  ])].sort();
  const allBuckets = ['3A', '3B', '3C'];
  for (const ing of allIngredients) {
    const row = { ingredient: ing };
    for (const bucket of allBuckets) {
      row[`${bucket}_count`] = coverageCount[ing]?.[bucket] || 0;
      const scores = coverageSqr[ing]?.[bucket] || [];
      row[`${bucket}_avgSqr`] = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;
    }
    heatmapData.push(row);
  }

  const payload = { heatmapData, totalPackets: packets.length, totalIngredients: allIngredients.length };
  _cache = payload;
  _cacheBuiltAt = Date.now();
  return NextResponse.json(payload);
}
