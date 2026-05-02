import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import {
  getRevisionById,
  markRevisionReverted,
  logRevision,
} from '@/lib/pcs-revisions';
import { REVISION_ENTITY_TYPES } from '@/lib/pcs-config';
import { updateDocumentField } from '@/lib/pcs-documents';
import { updateClaimField } from '@/lib/pcs-claims';
import { updateEvidencePacketField } from '@/lib/pcs-evidence-packets';
import { updateCanonicalClaimField } from '@/lib/pcs-canonical-claims';
import { updateFormulaLineField } from '@/lib/pcs-formula-lines';
import { updatePrefixField } from '@/lib/pcs-prefixes';
import { updateIngredientField } from '@/lib/pcs-ingredients';
import { updateIngredientFormField } from '@/lib/pcs-ingredient-forms';

/**
 * Wave 8 Phase A.7 — dispatch table mapping entity types to their
 * mutate()-wrapped single-field updaters (shipped in Phase C1-C4).
 * Adding a new entity type here unlocks revert support for that type.
 *
 * Returning `null` for an entity type means "revert is not yet wired for
 * this type"; the endpoint falls back to audit-only behavior in that case
 * and returns { dryRun: true } so the caller knows the live entity
 * wasn't modified.
 */
const ENTITY_UPDATERS = {
  [REVISION_ENTITY_TYPES.PCS_DOCUMENT]: updateDocumentField,
  [REVISION_ENTITY_TYPES.CLAIM]: updateClaimField,
  [REVISION_ENTITY_TYPES.EVIDENCE_PACKET]: updateEvidencePacketField,
  [REVISION_ENTITY_TYPES.CANONICAL_CLAIM]: updateCanonicalClaimField,
  // Wave 8.2 — taxonomy + composition entity types now wired.
  [REVISION_ENTITY_TYPES.FORMULA_LINE]: updateFormulaLineField,
  [REVISION_ENTITY_TYPES.CLAIM_PREFIX]: updatePrefixField,
  [REVISION_ENTITY_TYPES.ACTIVE_INGREDIENT]: updateIngredientField,
  [REVISION_ENTITY_TYPES.ACTIVE_INGREDIENT_FORM]: updateIngredientFormField,
  // `reviewer` intentionally unmapped — reviewer mutations have a separate
  // password-reset flow (Wave 7.0.7) and shouldn't share this revert path.
};

/**
 * Attempt to parse a revision's stored before/after value. These are JSON
 * strings when the original mutate() call emitted a structured snapshot,
 * but they can also be a primitive string for simple field edits. We try
 * JSON.parse first and fall through to the raw string on failure — which
 * matches the symmetry used by RevisionDiffView client-side.
 */
function parseStoredValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pcs/revisions/[id]/revert — Wave 8 Phase A
 *
 * Reverts a single revision. Super-user only (gated via
 * `pcs.revisions:revert`, which is in SUPER_USER_ONLY_CAPABILITIES, so the
 * capability guard auto-delegates to requireAdminLive for live Notion
 * re-verification).
 *
 * This endpoint is intentionally scoped MINIMALLY for Phase A:
 *   - It logs a new revision-of-the-revert entry so the undo action is
 *     itself audited.
 *   - It marks the source revision as reverted (setting revertedAt +
 *     revertedBy on the original Notion row).
 *   - It does NOT actually write the before-value back to the live
 *     entity in this phase. That requires the entity-specific `update*`
 *     helpers to be threaded through mutate() first (future phase).
 *     The response includes `{ dryRun: true }` so the caller knows the
 *     entity was not modified.
 *
 * When Phase C lands inline-edit PATCH endpoints, this route will be
 * extended to dispatch the entity-specific revert write through the
 * relevant entity helper, then flip dryRun to false.
 */
export async function POST(request, { params }) {
  const gate = await requireCapability(request, 'pcs.revisions:revert', {
    route: '/api/admin/pcs/revisions/[id]/revert',
  });
  if (gate.error) return gate.error;
  const { user } = gate;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Revision id is required.' }, { status: 400 });
  }

  // Parse body. The reason field is optional but strongly encouraged.
  let reason = '';
  try {
    const body = await request.json().catch(() => ({}));
    reason = (body?.reason || '').toString().slice(0, 1000);
  } catch {
    // no body is fine
  }

  // Load the source revision.
  const source = await getRevisionById(id);
  if (!source) {
    return NextResponse.json({ error: 'Revision not found.' }, { status: 404 });
  }
  if (source.revertedAt) {
    return NextResponse.json(
      { error: 'This revision has already been reverted.', revertedAt: source.revertedAt },
      { status: 409 },
    );
  }

  const actor = {
    email: user?.email || user?.alias || 'super-user@nordic-sqr-rct',
    roles: Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : ['super-user'],
  };

  // Phase A.7 — dispatch to the entity-specific updater, if one exists
  // for this entity type. Single-field reverts only (fieldPath must be
  // concrete, not 'bulk'/'create'/'delete'); bulk reverts will need a
  // separate batched-revert endpoint in a later wave.
  const updater = ENTITY_UPDATERS[source.entityType] || null;
  const canRewriteLive = Boolean(
    updater
    && source.fieldPath
    && !['bulk', 'create', 'delete'].includes(source.fieldPath)
  );
  const restoreValue = parseStoredValue(source.beforeValue);

  try {
    if (canRewriteLive) {
      // Step 1 (live path): rewrite the live entity by calling the
      // mutate()-wrapped updater. This produces its OWN revision row via
      // pcs-mutate's internal logRevision call, with the full snapshot.
      // We mark that revision as a revert by setting revertOfRevision on
      // the source row AFTER the write lands.
      try {
        await updater({
          id: source.entityId,
          fieldPath: source.fieldPath,
          value: restoreValue,
          actor,
          reason: reason
            ? `[REVERT of ${id}] ${reason}`
            : `[REVERT of ${id}]`,
        });
      } catch (writeErr) {
        // The live rewrite failed (allowlist mismatch, Notion error,
        // validation). Do NOT write the revert audit row in that case —
        // the source revision is untouched and the user sees an actionable
        // error message. Preserve the original error cause.
        const msg = writeErr?.message || String(writeErr);
        console.error(`[api] revert live-rewrite failed for ${source.entityType}:${source.entityId}/${source.fieldPath}: ${msg}`);
        return NextResponse.json(
          {
            error: 'Revert failed at live-rewrite step.',
            message: msg,
            sourceRevisionId: id,
            entityType: source.entityType,
            entityId: source.entityId,
            fieldPath: source.fieldPath,
          },
          { status: 500 },
        );
      }

      // Step 2: mark the source revision as reverted. The mutate() call
      // above already emitted a normal revision row for the rewrite; we
      // don't know its id synchronously, so markRevisionReverted stores
      // just the revertedAt/revertedBy/reason on the source.
      await markRevisionReverted({ revisionId: id, actor, reason });

      return NextResponse.json({
        ok: true,
        dryRun: false,
        message: 'Revert succeeded. The live entity was rewritten to the pre-edit value and the source revision is marked reverted.',
        sourceRevisionId: id,
        entityType: source.entityType,
        entityId: source.entityId,
        fieldPath: source.fieldPath,
      });
    }

    // Fallback path: no updater wired for this entity type, OR the
    // source revision recorded a bulk write (fieldPath === 'bulk') that
    // can't be single-field reverted. Log the audit trail so we don't
    // lose the intent, and return dryRun:true so the UI can surface it.
    const { id: newRevisionId } = await logRevision({
      actor,
      entityType: source.entityType,
      entityId: source.entityId,
      entityTitle: source.entityTitle,
      fieldPath: source.fieldPath,
      // Audit-only path: before = what's live now (the source's AFTER),
      // after = what we wanted to restore (the source's BEFORE).
      before: source.afterValue,
      after: source.beforeValue,
      reason: reason
        ? `[REVERT of ${id} · audit-only, no updater wired] ${reason}`
        : `[REVERT of ${id} · audit-only, no updater wired]`,
      revertOfRevision: id,
    });
    await markRevisionReverted({ revisionId: id, actor, reason, newRevisionId });

    return NextResponse.json({
      ok: true,
      dryRun: true,
      message: updater
        ? `Revert audit logged, but this revision's fieldPath ('${source.fieldPath}') is not single-field-revertable. The live entity was NOT rewritten.`
        : `Revert audit logged. No live-rewrite updater is wired for entity type '${source.entityType}' yet; the live entity was NOT rewritten.`,
      sourceRevisionId: id,
      newRevisionId,
      entityType: source.entityType,
      entityId: source.entityId,
      fieldPath: source.fieldPath,
    });
  } catch (err) {
    console.error('[api] revert revision failed:', err);
    return NextResponse.json(
      { error: 'Revert failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}
