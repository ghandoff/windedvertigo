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
import { memoize, invalidate as invalidateCache } from './in-memory-cache.js';
import { getPcsSupabase, mirrorToPostgres, shouldUseStrongConsistency, writePostgresFirst } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Day 2.6. No special column-name overrides for
// pcs_canonical_claims; all fields follow the camelCase → snake_case
// convention.
const CANONICAL_CLAIMS_PG_COLUMN_MAP = {};


const P = PROPS.canonicalClaims;
const CANONICAL_CLAIMS_CACHE_KEY = 'canonical-claims:all';
const CANONICAL_CLAIMS_CACHE_TTL_MS = 300_000; // 5 min — changes weekly

/** Drop the cached canonical-claim list. Call after any canonical-claim write. */
export function invalidateCanonicalClaimsCache() {
  invalidateCache(CANONICAL_CLAIMS_CACHE_KEY);
}

/**
 * 2026-05-06 — Path-2 Day 2.6 read-path swap. Convert a Postgres
 * pcs_canonical_claims row into the SAME shape parsePage(notionPage)
 * returns. Same conventions as pcs-evidence/pcs-claims/pcs-documents:
 * id is notion_page_id, createdTime/lastEditedTime come from the
 * mirrored Notion timestamps, empty strings vs null match Notion.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    canonicalClaim: row.canonical_claim || '',
    claimFamily: row.claim_family || null,
    evidenceTierRequired: row.evidence_tier_required || null,
    minimumEvidenceItems: row.minimum_evidence_items ?? null,
    notesGuardrails: row.notes_guardrails || '',
    pcsClaimInstanceIds: row.pcs_claim_instance_ids || [],
    claimPrefixId: row.claim_prefix_id || null,
    coreBenefitId: row.core_benefit_id || null,
    activeIngredientId: row.active_ingredient_id || null,
    benefitCategoryId: row.benefit_category_id || null,
    sourceCaipbRowId: row.source_caipb_row_id ?? null,
    canonicalKey: row.canonical_key || null,
    doseSensitivityApplied: row.dose_sensitivity_applied || null,
    dedupeDecision: row.dedupe_decision || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

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

export async function getAllCanonicalClaims(opts = {}) {
  return memoize(
    CANONICAL_CLAIMS_CACHE_KEY,
    CANONICAL_CLAIMS_CACHE_TTL_MS,
    _fetchAllCanonicalClaims,
    opts,
  );
}

async function _fetchAllCanonicalClaims() {
  return await _fetchAllCanonicalClaimsFromPostgres();
}

async function _fetchAllCanonicalClaimsFromPostgres() {
  // 94 rows today; Supabase default limit covers it with headroom.
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_canonical_claims')
    .select('*')
    .order('canonical_claim', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * 2026-05-06 — Path-2 drift catcher. See pcs-evidence.js
 * syncRecentEvidenceToPostgres for the full pattern.
 */
export async function syncRecentCanonicalClaimsToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.canonicalClaims,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_canonical_claims', parsed, CANONICAL_CLAIMS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, maxSeen, fetched: res.results.length };
}

/**
 * Sync a single Notion page into Postgres by page ID.
 * Used by the general page-updated webhook to mirror a specific
 * edited row immediately rather than waiting for the drift-sync cron.
 *
 * @param {string} pageId — Notion page ID
 */
export async function syncSingleCanonicalClaimPageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parsePage(page);
  return mirrorToPostgres('pcs_canonical_claims', parsed, CANONICAL_CLAIMS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
}

export async function getCanonicalClaim(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_canonical_claims')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
}

export async function getCanonicalClaimsByFamily(family) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('getCanonicalClaimsByFamily: Supabase client unavailable.');
  const { data, error } = await sb
    .from('pcs_canonical_claims')
    .select('*')
    .eq('claim_family', family);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
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
  const stubRow = { id, ...fields };
  await writePostgresFirst('pcs_canonical_claims', stubRow, CANONICAL_CLAIMS_PG_COLUMN_MAP);
  invalidateCanonicalClaimsCache();
  return stubRow;
}

/**
 * Wave 7.0.5 T2 — Find an existing canonical claim by its computed key.
 *
 * Postgres-first when PCS_READ_FROM_POSTGRES is on; Notion fallback on
 * any error. Returns null on missing or any failure (best-effort —
 * claim import never fails for canonical-key lookup issues).
 */
export async function findCanonicalClaimByKey(key) {
  if (!key || typeof key !== 'string') return null;
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_canonical_claims')
    .select('*')
    .eq('canonical_key', key)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
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
