/**
 * POST /api/pcs/labels/[id]/draft-copy — AI-assisted claim copy drafting
 * (Wave 5.5 — added 2026-04-21).
 *
 * Body: { regulatoryFramework, tone, charBudget, claimIds?, confirmCost? }
 *
 * Flow:
 *   1. Fetch label → follow pcsDocumentId → fetch latest version → fetch 3A claims.
 *   2. Filter to claimIds if provided, else all 3A-approved claims.
 *   3. Estimate cost; refuse if > $1.00 unless `confirmCost: true`.
 *   4. Call draftLabelCopy(...) and return the structured response.
 *
 * This endpoint is READ-ONLY from a data-integrity perspective: it never
 * writes to Notion. It is gated behind labels:upload purely because
 * it consumes AI credits (Claude Sonnet 4.5). Read-only users cannot burn
 * credits.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getLabel } from '@/lib/pcs-labels';
import { getDocument } from '@/lib/pcs-documents';
import { getVersion, getVersionsForDocument } from '@/lib/pcs-versions';
import { getClaimsForVersion } from '@/lib/pcs-claims';
import {
  draftLabelCopy,
  estimateCost,
  REGULATORY_FRAMEWORKS,
  TONES,
  CHAR_BUDGETS,
  LABEL_COPY_PROMPT_VERSION,
} from '@/lib/label-copy-drafter';

const COST_CONFIRM_THRESHOLD_USD = 1.0;

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'labels:upload', { route: '/api/pcs/labels/[id]/draft-copy' });
  if (auth.error) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { regulatoryFramework, tone, charBudget, claimIds, confirmCost } = body || {};

  if (!REGULATORY_FRAMEWORKS.includes(regulatoryFramework)) {
    return NextResponse.json(
      { error: `regulatoryFramework must be one of: ${REGULATORY_FRAMEWORKS.join(', ')}` },
      { status: 400 }
    );
  }
  if (!TONES.includes(tone)) {
    return NextResponse.json(
      { error: `tone must be one of: ${TONES.join(', ')}` },
      { status: 400 }
    );
  }
  if (!Object.keys(CHAR_BUDGETS).includes(charBudget)) {
    return NextResponse.json(
      { error: `charBudget must be one of: ${Object.keys(CHAR_BUDGETS).join(', ')}` },
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
      { error: 'Label has no backing PCS document — cannot draft copy.' },
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
      { error: 'Backing PCS document has no version — cannot draft copy.' },
      { status: 400 }
    );
  }

  // Load claims for the version, restrict to 3A + approved.
  const allClaims = await getClaimsForVersion(version.id).catch(() => []);
  let claims3A = allClaims.filter(c => c.claimBucket === '3A');
  // Optional: only use approved rows (status "Approved") when available.
  // Some rows may have null claimStatus on legacy imports — accept those too.
  claims3A = claims3A.filter(c => {
    const s = (c.claimStatus || '').toLowerCase();
    return s === '' || s === 'approved';
  });

  if (Array.isArray(claimIds) && claimIds.length > 0) {
    const wanted = new Set(claimIds);
    claims3A = claims3A.filter(c => wanted.has(c.id));
  }

  if (claims3A.length === 0) {
    return NextResponse.json(
      { error: 'No 3A-approved claims available to draft from.' },
      { status: 400 }
    );
  }

  // Cost gate.
  const cost = estimateCost(claims3A.length);
  if (cost.estUsd > COST_CONFIRM_THRESHOLD_USD && !confirmCost) {
    return NextResponse.json(
      {
        error: 'cost-confirm-required',
        message: `Estimated cost $${cost.estUsd.toFixed(2)} exceeds the $${COST_CONFIRM_THRESHOLD_USD.toFixed(2)} auto-approve threshold. Re-post with { confirmCost: true } to proceed.`,
        cost,
        claimCount: claims3A.length,
        promptVersion: LABEL_COPY_PROMPT_VERSION,
      },
      { status: 402 } // Payment Required — semantically apt for a confirm gate
    );
  }

  try {
    const result = await draftLabelCopy({
      pcsClaims: claims3A,
      regulatoryFramework,
      tone,
      charBudget,
    });
    return NextResponse.json({
      ...result,
      label: { id: label.id, sku: label.sku, pcsDocumentId: label.pcsDocumentId },
      pcs: { id: doc.id, pcsId: doc.pcsId, versionId: version.id, version: version.version },
      claimCount: claims3A.length,
    });
  } catch (err) {
    console.error('draft-copy error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to draft label copy' },
      { status: 500 }
    );
  }
}
