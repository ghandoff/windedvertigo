/**
 * AICS Broadcasting — propagation engine.
 *
 * POST /api/pcs/aics/[id]/claims/[claimId]/propagate
 *   ?dryRun=true   — preview mode: returns affected docs without writing
 *
 * Required capability: aics.documents:edit  (RA + admin + super-user)
 *
 * Flow:
 *   1. Fetch the AICS document and resolve the target claim from the
 *      latest version.
 *   2. Validate claim is Authorized.
 *   3. Resolve the canonical ingredient by matching aiName.
 *   4. Fetch all formula lines for that ingredient; filter by minDose.
 *   5. Deduplicate to unique PCS documents.
 *   6. Idempotency guard: skip docs already holding a claim seeded from
 *      this AICS claim (source_aics_claim_id match).
 *   7. In dry-run: return preview list.  Otherwise: bump version + seed
 *      claim on each qualifying PCS document.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getAicsDocument, getAicsVersionsForDocument, getAicsClaimsForVersion } from '@/lib/aics-documents';
import { resolveIngredient } from '@/lib/pcs-ingredients';
import { getFormulaLinesForIngredient } from '@/lib/pcs-formula-lines';
import { getVersion, getVersionsForDocument, createVersion, updateVersion } from '@/lib/pcs-versions';
import { createClaim } from '@/lib/pcs-claims';
import { setLatestVersion } from '@/lib/pcs-documents';
import { bumpVersion } from '@/lib/version-utils';
import { getPcsSupabase, shouldReadFromPostgres } from '@/lib/supabase-pcs';

export const dynamic = 'force-dynamic';

async function getAlreadyPropagatedDocIds(claimId) {
  if (!shouldReadFromPostgres()) return new Set();
  try {
    const sb = getPcsSupabase();
    const { data: claimRows, error: e1 } = await sb
      .from('pcs_claims')
      .select('pcs_version_id')
      .eq('source_aics_claim_id', claimId);
    if (e1) throw e1;
    const versionIds = (claimRows || []).map(r => r.pcs_version_id).filter(Boolean);
    if (!versionIds.length) return new Set();
    const { data: versionRows, error: e2 } = await sb
      .from('pcs_versions')
      .select('pcs_document_id')
      .in('notion_page_id', versionIds);
    if (e2) throw e2;
    return new Set((versionRows || []).map(r => r.pcs_document_id).filter(Boolean));
  } catch (err) {
    console.warn('[aics-propagate] idempotency guard failed, proceeding without:', err.message);
    return new Set();
  }
}

export async function POST(request, { params }) {
  const auth = await requireCapability(request, 'aics.documents:edit', {
    route: '/api/pcs/aics/[id]/claims/[claimId]/propagate',
  });
  if (auth.error) return auth.error;

  const { id: aicsDocId, claimId } = await params;
  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';

  // --- 1. Fetch AICS document ---
  const aicsDoc = await getAicsDocument(aicsDocId);
  if (!aicsDoc) {
    return NextResponse.json({ error: 'AICS document not found' }, { status: 404 });
  }

  // --- 2. Fetch the target claim from the latest version ---
  const versions = await getAicsVersionsForDocument(aicsDocId);
  const latestVersion = versions.find(v => v.isLatest) || versions[0];
  if (!latestVersion) {
    return NextResponse.json({ error: 'AICS document has no versions' }, { status: 422 });
  }
  const claims = await getAicsClaimsForVersion(latestVersion.id);
  const aicsClaim = claims.find(c => c.id === claimId);
  if (!aicsClaim) {
    return NextResponse.json({ error: 'AICS claim not found in latest version' }, { status: 404 });
  }

  // --- 3. Validate claim is Authorized ---
  if (aicsClaim.claimStatus !== 'Authorized') {
    return NextResponse.json(
      { error: `Claim is not Authorized (current status: ${aicsClaim.claimStatus || 'unknown'})` },
      { status: 422 }
    );
  }

  // --- 4. Resolve canonical ingredient from AICS aiName ---
  // resolveIngredient fetches the full ingredient list when called with null
  const ingredient = await resolveIngredient(aicsDoc.aiName, null);
  if (!ingredient) {
    return NextResponse.json(
      {
        error: `Could not resolve a canonical ingredient for "${aicsDoc.aiName}". ` +
          'Ensure a canonical ingredient with this name or synonym exists in the Ingredients database.',
      },
      { status: 422 }
    );
  }

  // --- 5. Get formula lines and filter by dose ---
  const formulaLines = await getFormulaLinesForIngredient(ingredient.id);

  const qualifying = formulaLines.filter(line => {
    if (!line.pcsVersionId) return false;
    // Unit guard: only compare when units match (avoids mg vs IU cross-comparison)
    if (aicsClaim.minDose !== null && aicsClaim.minDoseUnit) {
      if (line.amountUnit !== aicsClaim.minDoseUnit) return false;
      if ((line.amountPerServing ?? 0) < aicsClaim.minDose) return false;
    }
    return true;
  });

  // --- 6. Resolve unique PCS documents ---
  // Batch-fetch versions to get their document IDs
  const versionCache = new Map();
  async function resolveDocId(pcsVersionId) {
    if (versionCache.has(pcsVersionId)) return versionCache.get(pcsVersionId);
    try {
      const v = await getVersion(pcsVersionId);
      versionCache.set(pcsVersionId, v?.pcsDocumentId || null);
      return v?.pcsDocumentId || null;
    } catch {
      versionCache.set(pcsVersionId, null);
      return null;
    }
  }

  const docIdToLines = new Map();
  for (const line of qualifying) {
    const docId = await resolveDocId(line.pcsVersionId);
    if (!docId) continue;
    if (!docIdToLines.has(docId)) docIdToLines.set(docId, []);
    docIdToLines.get(docId).push(line);
  }

  // --- 7. Idempotency guard ---
  const alreadyPropagated = await getAlreadyPropagatedDocIds(claimId);
  const pendingDocIds = [...docIdToLines.keys()].filter(id => !alreadyPropagated.has(id));

  const skipped = [...docIdToLines.keys()]
    .filter(id => alreadyPropagated.has(id))
    .map(id => ({ pcsDocumentId: id, reason: 'already propagated' }));

  const claimPreview = aicsClaim.claimText
    ? aicsClaim.claimText.slice(0, 80) + (aicsClaim.claimText.length > 80 ? '…' : '')
    : '(no claim text)';

  // --- 8. Dry run ---
  if (dryRun) {
    const preview = await Promise.all(
      pendingDocIds.map(async (docId) => {
        const docVersions = await getVersionsForDocument(docId).catch(() => []);
        const latest = docVersions.find(v => v.isLatest) || docVersions[0];
        return {
          pcsDocumentId: docId,
          currentVersion: latest?.version || null,
          newVersion: bumpVersion(latest?.version || null),
        };
      })
    );
    return NextResponse.json({
      preview: true,
      aicsDocumentId: aicsDocId,
      claimId,
      claimText: claimPreview,
      ingredient: { id: ingredient.id, name: ingredient.canonicalName },
      count: pendingDocIds.length,
      documents: preview,
      skipped,
    });
  }

  // --- 9. Execute propagation ---
  const propagated = [];
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);
  const changeDesc = `Auto-propagated from ${aicsDoc.aicsId || 'AICS'} — "${claimPreview}"`;

  for (const docId of pendingDocIds) {
    try {
      const docVersions = await getVersionsForDocument(docId).catch(() => []);
      const latest = docVersions.find(v => v.isLatest) || docVersions[0];

      const newVersion = await createVersion({
        version: bumpVersion(latest?.version || null),
        pcsDocumentId: docId,
        effectiveDate: today,
        isLatest: true,
        supersedesId: latest?.id || null,
        versionNotes: changeDesc,
      });

      if (latest?.id) {
        await updateVersion(latest.id, { isLatest: false }).catch(err =>
          console.warn('[aics-propagate] failed to unset isLatest on old version:', err.message)
        );
      }

      await setLatestVersion(docId, newVersion.id).catch(err =>
        console.warn('[aics-propagate] failed to repoint latestVersion on doc:', err.message)
      );

      const newClaim = await createClaim({
        claim: aicsClaim.claimText || '',
        claimBucket: '3B',
        minDoseMg: aicsClaim.minDose ?? null,
        pcsVersionId: newVersion.id,
        sourceAicsClaimId: claimId,
      });

      propagated.push({
        pcsDocumentId: docId,
        newVersionId: newVersion.id,
        newVersionLabel: newVersion.version,
        newClaimId: newClaim.id,
      });
    } catch (err) {
      console.error(`[aics-propagate] failed for doc ${docId}:`, err.message);
      errors.push({ pcsDocumentId: docId, error: err.message });
    }
  }

  return NextResponse.json(
    {
      propagated: propagated.length,
      documents: propagated,
      skipped,
      errors,
      ingredient: { id: ingredient.id, name: ingredient.canonicalName },
      claimId,
    },
    { status: 200 }
  );
}
