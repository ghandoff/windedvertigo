import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAllDocuments } from '@/lib/pcs-documents';
import { getAllClaims, getClaimsWithoutEvidence } from '@/lib/pcs-claims';
import { getOpenRequests } from '@/lib/pcs-requests';
import { getAllEvidence } from '@/lib/pcs-evidence';
import { getAllEvidencePackets } from '@/lib/pcs-evidence-packets';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.claims:read', { route: '/api/pcs/dashboard' });
  if (auth.error) return auth.error;

  const [documents, claims, claimsNoEvidence, openRequests, evidence, packets] = await Promise.all([
    getAllDocuments(),
    getAllClaims(),
    getClaimsWithoutEvidence(),
    getOpenRequests(),
    getAllEvidence(),
    getAllEvidencePackets(),
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

  // Coverage heatmap: ingredient × bucket
  // Build claim→bucket lookup, then packet→ingredient via evidence
  const claimBucketMap = {};
  for (const c of claims) {
    claimBucketMap[c.id] = c.claimBucket || 'Unknown';
  }
  const evidenceIngredientMap = {};
  for (const e of evidence) {
    evidenceIngredientMap[e.id] = e.ingredient?.length ? e.ingredient : [];
  }

  const coverageCount = {}; // { ingredient: { bucket: count } }
  const coverageSqr = {};   // { ingredient: { bucket: [scores] } }
  const evidenceById = new Map(evidence.map(e => [e.id, e]));
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

  // Flatten heatmap for client
  const heatmapData = [];
  const allIngredients = [...new Set([
    ...Object.keys(coverageCount),
    ...evidence.flatMap(e => e.ingredient || []),
  ])].sort();
  const allBuckets = ['3A', '3B', '3C'];
  for (const ing of allIngredients) {
    const row = { ingredient: ing };
    for (const bucket of allBuckets) {
      row[`${bucket}_count`] = coverageCount[ing]?.[bucket] || 0;
      const scores = coverageSqr[ing]?.[bucket] || [];
      row[`${bucket}_avgSqr`] = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
        : null;
    }
    heatmapData.push(row);
  }

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

  return NextResponse.json({
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
    heatmapData,
  });
}
