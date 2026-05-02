/**
 * PCS Canonical Claims — read-heavy reference table of normalized claim concepts.
 *
 * Canonical claims are the stable, reusable claim definitions that PCS claims
 * link to. Managed by w.v, read-only for Nordic in the portal (but full CRUD
 * provided for admin use).
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { notion } from './notion.js';
import {
  computeCanonicalClaimKey,
  coerceDoseSensitivity,
  DOSE_SENSITIVITY,
} from './canonical-claim-key.js';
import { getPrefixDoseSensitivity } from './pcs-prefixes.js';
import { mutate } from './pcs-mutate.js';


const P = PROPS.canonicalClaims;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    canonicalClaim: p[P.canonicalClaim]?.title?.[0]?.plain_text || '',
    claimFamily: p[P.claimFamily]?.select?.name || null,
    evidenceTierRequired: p[P.evidenceTierRequired]?.select?.name || null,
    minimumEvidenceItems: p[P.minimumEvidenceItems]?.number ?? null,
    notesGuardrails: (p[P.notesGuardrails]?.rich_text || []).map(t => t.plain_text).join(''),
    pcsClaimInstanceIds: (p[P.pcsClaimInstances]?.relation || []).map(r => r.id),
    // Multi-profile architecture (Week 1) — added 2026-04-19
    claimPrefixId: (p[P.claimPrefix]?.relation || [])[0]?.id || null,
    coreBenefitId: (p[P.coreBenefit]?.relation || [])[0]?.id || null,
    activeIngredientId: (p[P.activeIngredient]?.relation || [])[0]?.id || null,
    benefitCategoryId: (p[P.benefitCategory]?.relation || [])[0]?.id || null,
    sourceCaipbRowId: p[P.sourceCaipbRowId]?.number ?? null,
    // Wave 7.0.5 T2 — canonical identity (added 2026-04-21)
    canonicalKey: (p[P.canonicalKey]?.rich_text || []).map(t => t.plain_text).join('') || null,
    doseSensitivityApplied: p[P.doseSensitivityApplied]?.select?.name || null,
    // Wave 8 Phase C1 — dedupe curation state
    dedupeDecision: p[P.dedupeDecision]?.select?.name || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllCanonicalClaims() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.canonicalClaims,
      start_cursor: cursor,
      sorts: [{ property: P.canonicalClaim, direction: 'ascending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getCanonicalClaim(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getCanonicalClaimsByFamily(family) {
  const res = await notion.databases.query({
    database_id: PCS_DB.canonicalClaims,
    filter: { property: P.claimFamily, select: { equals: family } },
    sorts: [{ property: P.canonicalClaim, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function updateCanonicalClaim(id, fields) {
  const properties = {};
  if (fields.canonicalClaim !== undefined) {
    properties[P.canonicalClaim] = { title: [{ text: { content: fields.canonicalClaim } }] };
  }
  if (fields.claimFamily !== undefined) {
    properties[P.claimFamily] = { select: { name: fields.claimFamily } };
  }
  if (fields.evidenceTierRequired !== undefined) {
    properties[P.evidenceTierRequired] = { select: { name: fields.evidenceTierRequired } };
  }
  if (fields.minimumEvidenceItems !== undefined) {
    properties[P.minimumEvidenceItems] = { number: fields.minimumEvidenceItems };
  }
  if (fields.notesGuardrails !== undefined) {
    properties[P.notesGuardrails] = { rich_text: [{ text: { content: fields.notesGuardrails } }] };
  }
  // Multi-profile architecture (Week 1) — added 2026-04-19
  if (fields.claimPrefixId !== undefined) {
    properties[P.claimPrefix] = fields.claimPrefixId
      ? { relation: [{ id: fields.claimPrefixId }] }
      : { relation: [] };
  }
  if (fields.coreBenefitId !== undefined) {
    properties[P.coreBenefit] = fields.coreBenefitId
      ? { relation: [{ id: fields.coreBenefitId }] }
      : { relation: [] };
  }
  if (fields.benefitCategoryId !== undefined) {
    properties[P.benefitCategory] = fields.benefitCategoryId
      ? { relation: [{ id: fields.benefitCategoryId }] }
      : { relation: [] };
  }
  if (fields.activeIngredientId !== undefined) {
    properties[P.activeIngredient] = fields.activeIngredientId
      ? { relation: [{ id: fields.activeIngredientId }] }
      : { relation: [] };
  }
  // Wave 8 Phase C1 — dedupe decision (select)
  if (fields.dedupeDecision !== undefined) {
    properties[P.dedupeDecision] = fields.dedupeDecision
      ? { select: { name: fields.dedupeDecision } }
      : { select: null };
  }
  // Wave 7.0.5 T2 — canonical identity bookkeeping (added 2026-04-21).
  if (fields.canonicalKey !== undefined) {
    properties[P.canonicalKey] = {
      rich_text: fields.canonicalKey
        ? [{ text: { content: String(fields.canonicalKey) } }]
        : [],
    };
  }
  if (fields.doseSensitivityApplied !== undefined) {
    properties[P.doseSensitivityApplied] = fields.doseSensitivityApplied
      ? { select: { name: fields.doseSensitivityApplied } }
      : { select: null };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

/**
 * Wave 7.0.5 T2 — Find an existing canonical claim by its computed key.
 *
 * Uses a Notion rich_text `equals` filter. Best-effort: returns null on any
 * error so claim import never fails for canonical-key lookup issues.
 */
export async function findCanonicalClaimByKey(key) {
  if (!key || typeof key !== 'string') return null;
  try {
    const res = await notion.databases.query({
      database_id: PCS_DB.canonicalClaims,
      filter: { property: P.canonicalKey, rich_text: { equals: key } },
      page_size: 1,
    });
    if (!res.results.length) return null;
    return parsePage(res.results[0]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[pcs-canonical-claims] findCanonicalClaimByKey failed:', err?.message || err);
    return null;
  }
}

/**
 * Wave 7.0.5 T2 — Compute the canonical-claim key for a spec, resolving
 * the prefix's dose sensitivity from the Claim Prefixes DB.
 *
 * Returns `{ key, sensitivity }`. Never throws — on lookup failure,
 * `sensitivity` falls back to NOT_APPLICABLE (dose omitted from key).
 */
export async function computeCanonicalClaimKeyForSpec(spec) {
  const rawSensitivity = spec?.prefixId
    ? await getPrefixDoseSensitivity(spec.prefixId)
    : null;
  const sensitivity = coerceDoseSensitivity(rawSensitivity);
  const key = computeCanonicalClaimKey({
    ...spec,
    prefixDoseSensitivity: sensitivity,
  });
  return { key, sensitivity };
}

export { DOSE_SENSITIVITY };

// ─── Wave 8 Phase C1 — inline-edit allowlist + mutate-wrapped writer ─────
//
// The inline-edit route (PATCH /api/admin/pcs/canonical-claims/[id]) is the
// ONLY way a canonical-claim field should be mutated from operator UI, and it
// ONLY accepts the keys below. New editable fields must be added here
// explicitly — anything not on the list 400s at the route layer.
//
// Each entry maps a stable client-facing `fieldPath` to:
//   - kind: 'text' | 'select' | 'relation'  — drives input widget + validation
//   - toUpdatePayload(value): returns the `fields` object consumed by
//     `updateCanonicalClaim()` (keeps per-field Notion-prop marshalling in
//     one place so the route doesn't need to know about property names).
//
// Keep the key names (title/prefix/benefitCategory/activeIngredient/claimFamily/
// notesGuardrails/dedupeDecision) semantic — they're what the Notion
// Revisions `fieldPath` column records.

export const CANONICAL_CLAIM_EDITABLE_FIELDS = Object.freeze({
  title: {
    kind: 'text',
    toUpdatePayload: (value) => ({ canonicalClaim: value == null ? '' : String(value) }),
  },
  prefix: {
    kind: 'relation',
    toUpdatePayload: (value) => ({ claimPrefixId: value || null }),
  },
  benefitCategory: {
    kind: 'relation',
    toUpdatePayload: (value) => ({ benefitCategoryId: value || null }),
  },
  activeIngredient: {
    kind: 'relation',
    toUpdatePayload: (value) => ({ activeIngredientId: value || null }),
  },
  claimFamily: {
    kind: 'select',
    toUpdatePayload: (value) => ({ claimFamily: value || null }),
  },
  notesGuardrails: {
    kind: 'text',
    toUpdatePayload: (value) => ({ notesGuardrails: value == null ? '' : String(value) }),
  },
  dedupeDecision: {
    kind: 'select',
    toUpdatePayload: (value) => ({ dedupeDecision: value || null }),
  },
});

export function isEditableCanonicalClaimField(fieldPath) {
  return Object.prototype.hasOwnProperty.call(
    CANONICAL_CLAIM_EDITABLE_FIELDS, fieldPath,
  );
}

/**
 * Wave 8 Phase C1 — write one allowlisted field on a canonical claim, logging
 * a PCS Revisions row via mutate(). Callers (route handlers, scripted
 * back-office jobs) should prefer this over the raw `updateCanonicalClaim()`
 * when the change is operator-initiated — it guarantees the audit trail.
 *
 * @param {object} args
 * @param {string} args.id         - Notion page id of the canonical claim
 * @param {string} args.fieldPath  - one of CANONICAL_CLAIM_EDITABLE_FIELDS keys
 * @param {*}      args.value      - new value (shape depends on field kind)
 * @param {object} args.actor      - { email, roles } — forwarded to revision
 * @param {string} [args.reason]   - optional operator note
 * @returns {Promise<object>} the parsed updated canonical-claim row
 */
export async function updateCanonicalClaimField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updateCanonicalClaimField: id is required.');
  const spec = CANONICAL_CLAIM_EDITABLE_FIELDS[fieldPath];
  if (!spec) {
    throw new Error(`updateCanonicalClaimField: "${fieldPath}" is not an editable field.`);
  }
  const payload = spec.toUpdatePayload(value);

  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.CANONICAL_CLAIM,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: async (entityId) => getCanonicalClaim(entityId),
    apply: async () => updateCanonicalClaim(id, payload),
  });
}

