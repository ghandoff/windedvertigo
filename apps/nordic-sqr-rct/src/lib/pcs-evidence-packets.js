/**
 * PCS Evidence Packets CRUD — junction table linking Claims to Evidence items.
 *
 * Each packet represents one claim ↔ evidence linkage with an evidence role
 * (structure-function vs mechanistic) and SQR-RCT threshold tracking.
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { notion } from './notion.js';
import { mutate } from './pcs-mutate.js';


const P = PROPS.evidencePackets;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p[P.name]?.title?.[0]?.plain_text || '',
    pcsClaimId: (p[P.pcsClaim]?.relation || [])[0]?.id || null,
    evidenceItemId: (p[P.evidenceItem]?.relation || [])[0]?.id || null,
    evidenceRole: p[P.evidenceRole]?.select?.name || null,
    meetsSqrThreshold: p[P.meetsSqrThreshold]?.checkbox || false,
    relevanceNote: (p[P.relevanceNote]?.rich_text || []).map(t => t.plain_text).join(''),
    sortOrder: p[P.sortOrder]?.number ?? null,
    // Lauren's template Tables 4/5/6 fields — added 2026-04-18
    substantiationTier: p[P.substantiationTier]?.select?.name || null,
    studyDoseAI: (p[P.studyDoseAI]?.rich_text || []).map(t => t.plain_text).join(''),
    studyDoseAmount: p[P.studyDoseAmount]?.number ?? null,
    studyDoseUnit: p[P.studyDoseUnit]?.select?.name || null,
    nullResultRationale: (p[P.nullResultRationale]?.rich_text || []).map(t => t.plain_text).join(''),
    keyTakeaway: (p[P.keyTakeaway]?.rich_text || []).map(t => t.plain_text).join(''),
    studyDesignSummary: (p[P.studyDesignSummary]?.rich_text || []).map(t => t.plain_text).join(''),
    sampleSize: p[P.sampleSize]?.number ?? null,
    positiveResults: (p[P.positiveResults]?.rich_text || []).map(t => t.plain_text).join(''),
    neutralResults: (p[P.neutralResults]?.rich_text || []).map(t => t.plain_text).join(''),
    negativeResults: (p[P.negativeResults]?.rich_text || []).map(t => t.plain_text).join(''),
    potentialBiases: (p[P.potentialBiases]?.rich_text || []).map(t => t.plain_text).join(''),
    // Wave 4.5.5 — per-item extractor confidence (0-1; Notion stores percent as fraction)
    confidence: p[P.confidence]?.number ?? null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Build Notion properties payload for Lauren's template fields on Evidence Packets.
 * Sparse update — only touches keys explicitly present in `fields`.
 */
function laurenTemplateProps(fields) {
  const out = {};
  if (fields.substantiationTier !== undefined) {
    out[P.substantiationTier] = fields.substantiationTier
      ? { select: { name: fields.substantiationTier } }
      : { select: null };
  }
  if (fields.studyDoseAI !== undefined) {
    out[P.studyDoseAI] = { rich_text: [{ text: { content: fields.studyDoseAI || '' } }] };
  }
  if (fields.studyDoseAmount !== undefined) {
    out[P.studyDoseAmount] = { number: fields.studyDoseAmount };
  }
  if (fields.studyDoseUnit !== undefined) {
    out[P.studyDoseUnit] = fields.studyDoseUnit
      ? { select: { name: fields.studyDoseUnit } }
      : { select: null };
  }
  if (fields.nullResultRationale !== undefined) {
    out[P.nullResultRationale] = { rich_text: [{ text: { content: fields.nullResultRationale || '' } }] };
  }
  if (fields.keyTakeaway !== undefined) {
    out[P.keyTakeaway] = { rich_text: [{ text: { content: fields.keyTakeaway || '' } }] };
  }
  if (fields.studyDesignSummary !== undefined) {
    out[P.studyDesignSummary] = { rich_text: [{ text: { content: fields.studyDesignSummary || '' } }] };
  }
  if (fields.sampleSize !== undefined) {
    out[P.sampleSize] = { number: fields.sampleSize };
  }
  if (fields.positiveResults !== undefined) {
    out[P.positiveResults] = { rich_text: [{ text: { content: fields.positiveResults || '' } }] };
  }
  if (fields.neutralResults !== undefined) {
    out[P.neutralResults] = { rich_text: [{ text: { content: fields.neutralResults || '' } }] };
  }
  if (fields.negativeResults !== undefined) {
    out[P.negativeResults] = { rich_text: [{ text: { content: fields.negativeResults || '' } }] };
  }
  if (fields.potentialBiases !== undefined) {
    out[P.potentialBiases] = { rich_text: [{ text: { content: fields.potentialBiases || '' } }] };
  }
  // Wave 4.5.5 — extractor confidence. Explicit null clears; undefined skips.
  if (fields.confidence !== undefined) {
    out[P.confidence] = { number: fields.confidence };
  }
  return out;
}

export async function getPacketsForClaim(claimId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.evidencePackets,
    filter: { property: P.pcsClaim, relation: { contains: claimId } },
    sorts: [{ property: P.sortOrder, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getPacketsForEvidenceItem(evidenceItemId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.evidencePackets,
    filter: { property: P.evidenceItem, relation: { contains: evidenceItemId } },
  });
  return res.results.map(parsePage);
}

export async function getAllEvidencePackets(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.evidencePackets,
      page_size: 100,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getEvidencePacket(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getPacketsNeedingRole() {
  const res = await notion.databases.query({
    database_id: PCS_DB.evidencePackets,
    filter: { property: P.evidenceRole, select: { is_empty: true } },
  });
  return res.results.map(parsePage);
}

export async function createEvidencePacket(fields) {
  const properties = {
    [P.name]: { title: [{ text: { content: fields.name || '' } }] },
  };
  if (fields.pcsClaimId) properties[P.pcsClaim] = { relation: [{ id: fields.pcsClaimId }] };
  if (fields.evidenceItemId) properties[P.evidenceItem] = { relation: [{ id: fields.evidenceItemId }] };
  if (fields.evidenceRole) properties[P.evidenceRole] = { select: { name: fields.evidenceRole } };
  if (fields.meetsSqrThreshold !== undefined) properties[P.meetsSqrThreshold] = { checkbox: fields.meetsSqrThreshold };
  if (fields.relevanceNote) properties[P.relevanceNote] = { rich_text: [{ text: { content: fields.relevanceNote } }] };
  if (fields.sortOrder !== undefined) properties[P.sortOrder] = { number: fields.sortOrder };
  Object.assign(properties, laurenTemplateProps(fields));

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.evidencePackets },
    properties,
  });
  return parsePage(page);
}

export async function deleteEvidencePacket(id) {
  await notion.pages.update({ page_id: id, archived: true });
}

/**
 * Wave 8 Phase C4 — inline-edit allowlist for Evidence Packets. Each entry
 * describes how to (a) validate the incoming value and (b) translate it into
 * the equivalent `updateEvidencePacket` fields payload. Keys here are the
 * `fieldPath` strings accepted by the PATCH route and recorded on the
 * PCS Revisions row.
 */
const EDITABLE_PACKET_FIELDS = Object.freeze({
  name: {
    type: 'text',
    toFields: (value) => ({ name: value == null ? '' : String(value) }),
  },
  substantiationTier: {
    type: 'select',
    toFields: (value) => ({ substantiationTier: value || null }),
  },
  evidenceRole: {
    type: 'select',
    toFields: (value) => ({ evidenceRole: value || null }),
  },
  keyTakeaway: {
    type: 'text',
    toFields: (value) => ({ keyTakeaway: value == null ? '' : String(value) }),
  },
  relevanceNote: {
    type: 'text',
    toFields: (value) => ({ relevanceNote: value == null ? '' : String(value) }),
  },
  studyDesignSummary: {
    type: 'text',
    toFields: (value) => ({ studyDesignSummary: value == null ? '' : String(value) }),
  },
  sampleSize: {
    type: 'number',
    toFields: (value) => {
      if (value === null || value === '' || value === undefined) return { sampleSize: null };
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new Error('sampleSize must be a finite number.');
      }
      return { sampleSize: n };
    },
  },
  meetsSqrThreshold: {
    type: 'checkbox',
    toFields: (value) => ({ meetsSqrThreshold: Boolean(value) }),
  },
  nullResultRationale: {
    type: 'text',
    toFields: (value) => ({ nullResultRationale: value == null ? '' : String(value) }),
  },
});

/** Field keys allowed by the Wave 8 Phase C4 inline-edit endpoint. */
export const EVIDENCE_PACKET_EDITABLE_FIELDS = Object.freeze(Object.keys(EDITABLE_PACKET_FIELDS));

/**
 * Wave 8 Phase C4 — single-field inline edit for Evidence Packets.
 * Routed through `mutate()` so every change emits a PCS Revisions row.
 *
 * Only the allowlisted fields in `EDITABLE_PACKET_FIELDS` are accepted;
 * anything else throws synchronously with an `allowlist` error so the
 * caller can return 400.
 *
 * @param {object} args
 * @param {string} args.id         - evidence packet page id
 * @param {string} args.fieldPath  - one of EVIDENCE_PACKET_EDITABLE_FIELDS
 * @param {*}      args.value      - new value (shape depends on field type)
 * @param {object} [args.actor]    - { email, roles } — forwarded to mutate()
 * @param {string} [args.reason]   - optional operator note for the revision row
 * @returns {Promise<object>} the updated packet (as parsed by getEvidencePacket)
 */
export async function updateEvidencePacketField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updateEvidencePacketField: id is required.');
  if (!fieldPath || typeof fieldPath !== 'string') {
    throw new Error('updateEvidencePacketField: fieldPath is required.');
  }
  const spec = EDITABLE_PACKET_FIELDS[fieldPath];
  if (!spec) {
    const err = new Error(`Field "${fieldPath}" is not in the Evidence Packet inline-edit allowlist.`);
    err.code = 'allowlist';
    throw err;
  }
  const fields = spec.toFields(value);

  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.EVIDENCE_PACKET,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: (pid) => getEvidencePacket(pid),
    apply: () => updateEvidencePacket(id, fields),
  });
}

export async function updateEvidencePacket(id, fields) {
  const properties = {};
  if (fields.name !== undefined) {
    properties[P.name] = { title: [{ text: { content: fields.name } }] };
  }
  if (fields.evidenceRole !== undefined) {
    properties[P.evidenceRole] = fields.evidenceRole
      ? { select: { name: fields.evidenceRole } }
      : { select: null };
  }
  if (fields.meetsSqrThreshold !== undefined) {
    properties[P.meetsSqrThreshold] = { checkbox: fields.meetsSqrThreshold };
  }
  if (fields.relevanceNote !== undefined) {
    properties[P.relevanceNote] = { rich_text: [{ text: { content: fields.relevanceNote } }] };
  }
  if (fields.sortOrder !== undefined) {
    properties[P.sortOrder] = { number: fields.sortOrder };
  }
  if (fields.pcsClaimId !== undefined) {
    properties[P.pcsClaim] = fields.pcsClaimId
      ? { relation: [{ id: fields.pcsClaimId }] }
      : { relation: [] };
  }
  if (fields.evidenceItemId !== undefined) {
    properties[P.evidenceItem] = fields.evidenceItemId
      ? { relation: [{ id: fields.evidenceItemId }] }
      : { relation: [] };
  }
  Object.assign(properties, laurenTemplateProps(fields));
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}
