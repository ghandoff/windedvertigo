/**
 * POST /api/pcs/labels/[id]/suggest-reformulation — AI-assisted reformulation
 * suggestions for safety-flagged label ingredients (Wave 5.6 — added 2026-04-21).
 *
 * Body: {
 *   flaggedIngredient: string,
 *   currentDose?: number,
 *   currentDoseUnit?: string,
 *   demographic?: string,
 *   safetyEvidenceId?: string,
 *   confirmCost?: true
 * }
 *
 * Flow:
 *   1. Fetch label → follow pcsDocumentId → fetch latest version → fetch 3A claims.
 *   2. Fetch safety evidence by id (optional — may be a forward-looking call).
 *   3. Estimate cost; refuse if > $0.50 unless `confirmCost: true`.
 *   4. Call suggestReformulations(...) and return the structured response.
 *
 * READ-ONLY: never writes to Notion. Auth-gated behind labels:upload
 * purely because it consumes AI credits (Claude Sonnet 4.5). Mirrors the
 * Wave 5.5 draft-copy endpoint exactly.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getLabel } from '@/lib/pcs-labels';
import { getDocument } from '@/lib/pcs-documents';
import { getVersion, getVersionsForDocument } from '@/lib/pcs-versions';
import { getClaimsForVersion } from '@/lib/pcs-claims';
import { getEvidence } from '@/lib/pcs-evidence';
import {
  suggestReformulations,
  estimateCost,
  REFORMULATION_PROMPT_VERSION,
} from '@/lib/reformulation-suggester';

const COST_CONFIRM_THRESHOLD_USD = 0.5;

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/pcs/labels/[id]/suggest-reformulation' });
  if (auth.error) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    flaggedIngredient,
    currentDose,
    currentDoseUnit,
    demographic,
    safetyEvidenceId,
    confirmCost,
  } = body || {};

  if (!flaggedIngredient || typeof flaggedIngredient !== 'string') {
    return NextResponse.json(
      { error: 'flaggedIngredient (string) is required.' },
      { status: 400 }
    );
  }

  let label;
  try {
    label = await getLabel(id);
  } catch {
    return NextResponse.json({ error: 'Label not found' }, { status: 404 });
  }
  if (!label?.pcsDocumentId) {
    return NextResponse.json(
      { error: 'Label has no backing PCS document — cannot suggest reformulation.' },
      { status: 400 }
    );
  }

  // Resolve latest version of the backing PCS.
  let doc;
  try {
    doc = await getDocument(label.pcsDocumentId);
  } catch {
    return NextResponse.json({ error: 'Backing PCS document not found' }, { status: 404 });
  }

  let version = null;
  if (doc.latestVersionId) {
    try { version = await getVersion(doc.latestVersionId); } catch { version = null; }
  }
  if (!version) {
    const all = await getVersionsForDocument(doc.id).catch(() => []);
    version = all.find(v => v.isLatest) || all[0] || null;
  }
  if (!version) {
    return NextResponse.json(
      { error: 'Backing PCS document has no version — cannot suggest reformulation.' },
      { status: 400 }
    );
  }

  // Load 3A claims for the version (approved or status-unset legacy rows).
  const allClaims = await getClaimsForVersion(version.id).catch(() => []);
  const claims3A = allClaims.filter(c => {
    if (c.claimBucket !== '3A') return false;
    const s = (c.claimStatus || '').toLowerCase();
    return s === '' || s === 'approved';
  });

  // Optional safety evidence fetch — the workflow will almost always pass
  // this, but direct operator calls may not.
  let safetyEvidence = null;
  if (safetyEvidenceId) {
    try { safetyEvidence = await getEvidence(safetyEvidenceId); }
    catch { safetyEvidence = null; }
  }

  // Cost gate — Wave 5.6 uses $0.50, tighter than Wave 5.5's $1.00 because
  // reformulation is a narrow, single-label operation.
  const cost = estimateCost(claims3A.length);
  if (cost.estUsd > COST_CONFIRM_THRESHOLD_USD && !confirmCost) {
    return NextResponse.json(
      {
        error: 'cost-confirm-required',
        message: `Estimated cost $${cost.estUsd.toFixed(4)} exceeds the $${COST_CONFIRM_THRESHOLD_USD.toFixed(2)} auto-approve threshold. Re-post with { confirmCost: true } to proceed.`,
        cost,
        claimCount: claims3A.length,
        promptVersion: REFORMULATION_PROMPT_VERSION,
      },
      { status: 402 } // Payment Required — semantically apt for a confirm gate
    );
  }

  try {
    const result = await suggestReformulations({
      label,
      pcs: { id: doc.id, pcsId: doc.pcsId, versionId: version.id, version: version.version },
      claims: claims3A,
      flaggedIngredient,
      currentDose,
      currentDoseUnit,
      demographic,
      safetyEvidence,
    });
    return NextResponse.json({
      ...result,
      label: { id: label.id, sku: label.sku, pcsDocumentId: label.pcsDocumentId },
      pcs: { id: doc.id, pcsId: doc.pcsId, versionId: version.id, version: version.version },
      claimCount: claims3A.length,
      safetyEvidenceId: safetyEvidence?.id || null,
      flaggedIngredient,
      currentDose: currentDose ?? null,
      currentDoseUnit: currentDoseUnit || null,
      demographic: demographic || null,
    });
  } catch (err) {
    console.error('suggest-reformulation error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to suggest reformulations' },
      { status: 500 }
    );
  }
}
