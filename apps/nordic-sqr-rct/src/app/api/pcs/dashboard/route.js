import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllDocuments } from '@/lib/pcs-documents';
import { getAllClaims, getClaimsWithoutEvidence } from '@/lib/pcs-claims';
import { getOpenRequests } from '@/lib/pcs-requests';
import { getAllEvidence } from '@/lib/pcs-evidence';

// 2026-05-03 perf fixes:
//   1. In-memory cache (60s TTL) — survives across warm invocations.
//   2. Heatmap split — the 1783-row evidence_packets fetch (~11s) moved
//      to /api/pcs/dashboard/coverage so the KPI payload returns in
//      ~3s on first hit. The /pcs page lazy-fetches coverage after KPIs
//      paint.
let _cache = null;
let _cacheBuiltAt = 0;
const CACHE_TTL_MS = 60 * 1000;

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.claims:read', { route: '/api/pcs/dashboard' });
  if (auth.error) return auth.error;

  if (_cache && Date.now() - _cacheBuiltAt < CACHE_TTL_MS) {
    return NextResponse.json(_cache);
  }

  // Heatmap is fetched lazily by /api/pcs/dashboard/coverage; this route
  // only fetches what KPI cards + simple charts need (5 DBs, ~3s p95).
  const [documents, claims, claimsNoEvidence, openRequests, evidence] = await Promise.all([
    getAllDocuments(),
    getAllClaims(),
    getClaimsWithoutEvidence(),
    getOpenRequests(),
    getAllEvidence(),
  ]);

  const underRevision = documents.filter(d => d.fileStatus === 'Under revision').length;
  const sqrReviewed = evidence.filter(e => e.sqrReviewed).length;

  // Claims by bucket
  const bucketCounts = {};
  for (const c of claims) {
    const b = c.claimBucket || 'Unknown';
    bucketCounts[b] = (bucketCounts[b] || 0) + 1;
  }

  // Claims by status (for pipeline chart)
  const claimsByStatus = {};
  for (const c of claims) {
    const s = c.claimStatus || 'Unknown';
    claimsByStatus[s] = (claimsByStatus[s] || 0) + 1;
  }

  // Claims pipeline: bucket × status
  const claimsPipeline = {};
  for (const c of claims) {
    const bucket = c.claimBucket || 'Unknown';
    const status = c.claimStatus || 'Unknown';
    if (!claimsPipeline[bucket]) claimsPipeline[bucket] = {};
    claimsPipeline[bucket][status] = (claimsPipeline[bucket][status] || 0) + 1;
  }

  // Evidence by type (for donut chart)
  const evidenceByType = {};
  for (const e of evidence) {
    const t = e.evidenceType || 'Other';
    evidenceByType[t] = (evidenceByType[t] || 0) + 1;
  }

  // Evidence by review status
  const evidenceByReviewStatus = {
    Reviewed: sqrReviewed,
    Unreviewed: evidence.length - sqrReviewed,
  };

  // SQR score distribution (for bar chart)
  // SQR-RCT rubric: 11 questions × 0-2 = max 22. Exclude out-of-range scores.
  const sqrDistribution = [];
  const scored = evidence.filter(e => e.sqrScore != null && e.sqrScore >= 0 && e.sqrScore <= 22);
  const bins = [
    { label: '0–10', min: 0, max: 10 },
    { label: '11–16', min: 11, max: 16 },
    { label: '17–22', min: 17, max: 22 },
  ];
  for (const bin of bins) {
    const count = scored.filter(e => e.sqrScore >= bin.min && e.sqrScore <= bin.max).length;
    sqrDistribution.push({ range: bin.label, count });
  }

  // SQR distribution by evidence type
  const sqrByType = {};
  for (const e of scored) {
    const t = e.evidenceType || 'Other';
    if (!sqrByType[t]) sqrByType[t] = [];
    sqrByType[t].push(e.sqrScore);
  }
  const sqrDistributionByType = {};
  for (const [type, scores] of Object.entries(sqrByType)) {
    sqrDistributionByType[type] = bins.map(bin => ({
      range: bin.label,
      count: scores.filter(s => s >= bin.min && s <= bin.max).length,
    }));
  }

  // Heatmap (coverageCount / coverageSqr / heatmapData) moved to
  // /api/pcs/dashboard/coverage — see file header.

  // Overdue requests
  const now = new Date();
  const overdueRequests = openRequests.filter(r => {
    const due = r.raDue || r.resDue;
    return due && new Date(due) < now;
  }).length;

  // Avg SQR score (uses only valid 0–22 scores, already filtered above)
  const avgSqr = scored.length > 0
    ? Math.round(scored.reduce((s, e) => s + e.sqrScore, 0) / scored.length * 10) / 10
    : null;

  const payload = {
    // KPIs
    totalDocuments: documents.length,
    underRevision,
    totalClaims: claims.length,
    claimsWithoutEvidence: claimsNoEvidence.length,
    openRequests: openRequests.length,
    overdueRequests,
    totalEvidence: evidence.length,
    sqrReviewedEvidence: sqrReviewed,
    sqrReviewPercent: evidence.length > 0 ? Math.round((sqrReviewed / evidence.length) * 100) : 0,
    avgSqrScore: avgSqr,
    claimsAuthorizedPercent: claims.length > 0
      ? Math.round(claims.filter(c => c.claimStatus === 'Authorized').length / claims.length * 100)
      : 0,

    // Chart data
    claimsByBucket: bucketCounts,
    claimsByStatus,
    claimsPipeline,
    evidenceByType,
    evidenceByReviewStatus,
    sqrDistribution,
    sqrDistributionByType,
    // heatmapData lazy-loaded via /api/pcs/dashboard/coverage
  };

  _cache = payload;
  _cacheBuiltAt = Date.now();
  return NextResponse.json(payload);
}
