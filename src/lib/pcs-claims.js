/**
 * PCS Claims CRUD — health claims attached to PCS versions.
 *
 * Claims are bucketed (3A/3B/3C) and linked to evidence packets,
 * canonical claims, and wording variants.
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES, CLAIM_STATUSES, CLAIM_BUCKETS } from './pcs-config.js';
import { notion } from './notion.js';
import {
  computeCanonicalClaimKeyForSpec,
  findCanonicalClaimByKey,
} from './pcs-canonical-claims.js';
import { mutate } from './pcs-mutate.js';


const P = PROPS.claims;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    claim: p[P.claim]?.title?.[0]?.plain_text || '',
    claimNo: (p[P.claimNo]?.rich_text || []).map(t => t.plain_text).join(''),
    claimBucket: p[P.claimBucket]?.select?.name || null,
    claimStatus: p[P.claimStatus]?.select?.name || null,
    claimNotes: (p[P.claimNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    disclaimerRequired: p[P.disclaimerRequired]?.checkbox || false,
    minDoseMg: p[P.minDoseMg]?.number ?? null,
    maxDoseMg: p[P.maxDoseMg]?.number ?? null,
    doseGuidanceNote: (p[P.doseGuidanceNote]?.rich_text || []).map(t => t.plain_text).join(''),
    pcsVersionId: (p[P.pcsVersion]?.relation || [])[0]?.id || null,
    canonicalClaimId: (p[P.canonicalClaim]?.relation || [])[0]?.id || null,
    // Multi-profile architecture (Week 1) — added 2026-04-19
    claimPrefixId: (p[P.claimPrefix]?.relation || [])[0]?.id || null,
    coreBenefitId: (p[P.coreBenefit]?.relation || [])[0]?.id || null,
    evidencePacketIds: (p[P.evidencePacketLinks]?.relation || []).map(r => r.id),
    wordingVariantIds: (p[P.wordingVariants]?.relation || []).map(r => r.id),
    // NutriGrade body-of-evidence fields — see src/lib/nutrigrade.js
    heterogeneity: p[P.heterogeneity]?.select?.name || null,
    publicationBias: p[P.publicationBias]?.select?.name || null,
    fundingBias: p[P.fundingBias]?.select?.name || null,
    precision: p[P.precision]?.select?.name || null,
    effectSizeCategory: p[P.effectSizeCategory]?.select?.name || null,
    doseResponseGradient: p[P.doseResponseGradient]?.select?.name || null,
    certaintyScore: p[P.certaintyScore]?.number ?? null,
    certaintyRating: p[P.certaintyRating]?.select?.name || null,
    // Wave 4.5.5 — per-item extractor confidence (0-1; Notion stores percent as fraction)
    confidence: p[P.confidence]?.number ?? null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getClaimsForVersion(versionId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.claims,
    filter: { property: P.pcsVersion, relation: { contains: versionId } },
    sorts: [{ property: P.claimNo, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getAllClaims(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.claims,
      page_size: 100,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getClaim(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getClaimsByBucket(bucket) {
  const res = await notion.databases.query({
    database_id: PCS_DB.claims,
    filter: { property: P.claimBucket, select: { equals: bucket } },
  });
  return res.results.map(parsePage);
}

export async function getClaimsWithoutEvidence() {
  const res = await notion.databases.query({
    database_id: PCS_DB.claims,
    filter: { property: P.evidencePacketLinks, relation: { is_empty: true } },
  });
  return res.results.map(parsePage);
}

export async function updateClaim(id, fields) {
  const properties = {};
  if (fields.claim !== undefined) {
    properties[P.claim] = { title: [{ text: { content: fields.claim } }] };
  }
  if (fields.claimNo !== undefined) {
    properties[P.claimNo] = { rich_text: [{ text: { content: fields.claimNo } }] };
  }
  if (fields.claimBucket !== undefined) {
    properties[P.claimBucket] = fields.claimBucket
      ? { select: { name: fields.claimBucket } }
      : { select: null };
  }
  if (fields.claimStatus !== undefined) {
    properties[P.claimStatus] = fields.claimStatus
      ? { select: { name: fields.claimStatus } }
      : { select: null };
  }
  if (fields.claimNotes !== undefined) {
    properties[P.claimNotes] = { rich_text: [{ text: { content: fields.claimNotes } }] };
  }
  if (fields.disclaimerRequired !== undefined) {
    properties[P.disclaimerRequired] = { checkbox: fields.disclaimerRequired };
  }
  if (fields.minDoseMg !== undefined) {
    properties[P.minDoseMg] = { number: fields.minDoseMg };
  }
  if (fields.maxDoseMg !== undefined) {
    properties[P.maxDoseMg] = { number: fields.maxDoseMg };
  }
  if (fields.canonicalClaimId !== undefined) {
    properties[P.canonicalClaim] = fields.canonicalClaimId
      ? { relation: [{ id: fields.canonicalClaimId }] }
      : { relation: [] };
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
  // NutriGrade select fields — sparse updates; null/undefined means "don't touch."
  // Explicit null in the payload clears the select; undefined leaves it unchanged.
  const selectFields = [
    ['heterogeneity', P.heterogeneity],
    ['publicationBias', P.publicationBias],
    ['fundingBias', P.fundingBias],
    ['precision', P.precision],
    ['effectSizeCategory', P.effectSizeCategory],
    ['doseResponseGradient', P.doseResponseGradient],
    ['certaintyRating', P.certaintyRating],
  ];
  for (const [key, propName] of selectFields) {
    if (fields[key] !== undefined) {
      properties[propName] = fields[key]
        ? { select: { name: fields[key] } }
        : { select: null };
    }
  }
  if (fields.certaintyScore !== undefined) {
    properties[P.certaintyScore] = { number: fields.certaintyScore };
  }
  // Wave 4.5.5 — extractor confidence. Explicit null clears; undefined = don't touch.
  if (fields.confidence !== undefined) {
    properties[P.confidence] = { number: fields.confidence };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

export async function createClaim(fields) {
  const properties = {
    [P.claim]: { title: [{ text: { content: fields.claim } }] },
  };
  if (fields.claimNo) properties[P.claimNo] = { rich_text: [{ text: { content: fields.claimNo } }] };
  if (fields.claimBucket) properties[P.claimBucket] = { select: { name: fields.claimBucket } };
  if (fields.claimStatus) properties[P.claimStatus] = { select: { name: fields.claimStatus } };
  if (fields.disclaimerRequired !== undefined) properties[P.disclaimerRequired] = { checkbox: fields.disclaimerRequired };
  if (fields.pcsVersionId) properties[P.pcsVersion] = { relation: [{ id: fields.pcsVersionId }] };

  // Wave 7.0.5 T2 — if the caller didn't already pick a canonical claim,
  // try to resolve one by identity key (prefix + benefit + AI + dose,
  // where dose is only included when prefix.dose_sensitivity is
  // dose_gated or dose_qualified). Best-effort: any failure here is
  // swallowed — we still create the claim, just without a canonical link.
  let canonicalClaimId = fields.canonicalClaimId || null;
  if (!canonicalClaimId && fields.claimPrefixId) {
    try {
      const { key } = await computeCanonicalClaimKeyForSpec({
        prefixId: fields.claimPrefixId,
        coreBenefitId: fields.coreBenefitId || null,
        activeIngredientId: fields.activeIngredientId || null,
        activeIngredientFormId: fields.activeIngredientFormId || null,
        dose: fields.minDoseMg ?? null,
        doseUnit: fields.doseUnit || 'mg',
        demographicAxes: fields.demographicAxes || null,
      });
      const existing = await findCanonicalClaimByKey(key);
      if (existing) canonicalClaimId = existing.id;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[pcs-claims] canonical-key resolve failed:', err?.message || err);
    }
  }
  if (canonicalClaimId) properties[P.canonicalClaim] = { relation: [{ id: canonicalClaimId }] };
  if (fields.claimPrefixId) properties[P.claimPrefix] = { relation: [{ id: fields.claimPrefixId }] };
  if (fields.coreBenefitId) properties[P.coreBenefit] = { relation: [{ id: fields.coreBenefitId }] };
  if (fields.minDoseMg !== undefined) properties[P.minDoseMg] = { number: fields.minDoseMg };
  if (fields.maxDoseMg !== undefined) properties[P.maxDoseMg] = { number: fields.maxDoseMg };
  if (fields.doseGuidanceNote) properties[P.doseGuidanceNote] = { rich_text: [{ text: { content: fields.doseGuidanceNote } }] };
  // Wave 4.5.5 — extractor confidence (accepts 0-1 number; null/undefined are skipped on create).
  if (fields.confidence !== undefined && fields.confidence !== null) {
    properties[P.confidence] = { number: fields.confidence };
  }

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.claims },
    properties,
  });
  return parsePage(page);
}

/**
 * Wave 8 Phase C3 — single-field inline edit for Claims. Routes through
 * mutate() so every edit lands in the PCS Revisions audit log with a
 * before/after snapshot. The allowlist is the narrow set of fields the
 * claim-detail UI exposes as inline controls; other fields must still go
 * through domain-specific endpoints (certainty, applicability, dose).
 *
 * @param {object} args
 * @param {string} args.id            - Claim Notion page id
 * @param {string} args.fieldPath     - one of the allowlisted keys
 * @param {*}      args.value         - new value (string | number | null)
 * @param {object} [args.actor]       - { email, roles }
 * @param {string} [args.reason]      - optional operator note
 */
export async function updateClaimField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updateClaimField: id is required.');
  if (!fieldPath) throw new Error('updateClaimField: fieldPath is required.');

  const ALLOWED = new Set([
    'claim',
    'claimPrefix',
    'claimBucket',
    'claimStatus',
    'minDoseMg',
    'maxDoseMg',
    'notes',
  ]);
  if (!ALLOWED.has(fieldPath)) {
    const err = new Error(`updateClaimField: fieldPath "${fieldPath}" is not editable via this endpoint.`);
    err.code = 'field-not-allowed';
    throw err;
  }

  // Per-field coercion + enum validation.
  let coerced = value;
  switch (fieldPath) {
    case 'claim': {
      if (value == null) throw Object.assign(new Error('claim text cannot be null.'), { code: 'invalid-value' });
      coerced = String(value);
      break;
    }
    case 'notes': {
      coerced = value == null ? '' : String(value);
      break;
    }
    case 'claimBucket': {
      if (value != null && !CLAIM_BUCKETS.includes(value)) {
        throw Object.assign(new Error(`Invalid claimBucket: ${value}`), { code: 'invalid-value' });
      }
      coerced = value || null;
      break;
    }
    case 'claimStatus': {
      if (value != null && !CLAIM_STATUSES.includes(value)) {
        throw Object.assign(new Error(`Invalid claimStatus: ${value}`), { code: 'invalid-value' });
      }
      coerced = value || null;
      break;
    }
    case 'minDoseMg':
    case 'maxDoseMg': {
      if (value === '' || value == null) {
        coerced = null;
      } else {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          throw Object.assign(new Error(`Invalid ${fieldPath}: ${value}`), { code: 'invalid-value' });
        }
        coerced = n;
      }
      break;
    }
    case 'claimPrefix': {
      // Expect a Notion page id string, or null to clear.
      coerced = value ? String(value) : null;
      break;
    }
    default:
      break;
  }

  // Map helper-key → updateClaim field key.
  const updatePayload = {};
  switch (fieldPath) {
    case 'claim':         updatePayload.claim = coerced; break;
    case 'notes':         updatePayload.claimNotes = coerced; break;
    case 'claimBucket':   updatePayload.claimBucket = coerced; break;
    case 'claimStatus':   updatePayload.claimStatus = coerced; break;
    case 'minDoseMg':     updatePayload.minDoseMg = coerced; break;
    case 'maxDoseMg':     updatePayload.maxDoseMg = coerced; break;
    case 'claimPrefix':   updatePayload.claimPrefixId = coerced; break;
  }

  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.CLAIM,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: async (entityId) => getClaim(entityId),
    apply: async () => updateClaim(id, updatePayload),
  });
}
