/**
 * PCS Claim Prefixes CRUD
 *
 * The leading clause of a claim ("supports", "may support", "required for", …).
 * Same core benefit + different prefix = DIFFERENT canonical claim with different
 * regulatory tier and dose requirements (per Lauren's CAI-PBE design).
 *
 * Multi-profile architecture (Week 1) — added 2026-04-19.
 */

import { PCS_DB, PROPS, REVISION_ENTITY_TYPES } from './pcs-config.js';
import { notion } from './notion.js';
import { mutate } from './pcs-mutate.js';


const P = PROPS.prefixes;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    prefix: p[P.prefix]?.title?.[0]?.plain_text || '',
    regulatoryTier: p[P.regulatoryTier]?.select?.name || null,
    displayOrder: p[P.displayOrder]?.number ?? null,
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    // CAIPB cleanup + Gina's refinements — added 2026-04-19
    evidenceType: p[P.evidenceType]?.select?.name || null,
    qualificationLevel: p[P.qualificationLevel]?.select?.name || null,
    // Wave 7.0.5 T1/T2 — drives canonical-claim identity hashing (added 2026-04-21).
    doseSensitivity: p[P.doseSensitivity]?.select?.name || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllPrefixes() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.prefixes,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: P.displayOrder, direction: 'ascending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getPrefix(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function createPrefix(fields) {
  const properties = {
    [P.prefix]: { title: [{ text: { content: fields.prefix || '' } }] },
  };
  if (fields.regulatoryTier) {
    properties[P.regulatoryTier] = { select: { name: fields.regulatoryTier } };
  }
  if (fields.displayOrder !== undefined) {
    properties[P.displayOrder] = { number: fields.displayOrder };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  if (fields.evidenceType) {
    properties[P.evidenceType] = { select: { name: fields.evidenceType } };
  }
  if (fields.qualificationLevel) {
    properties[P.qualificationLevel] = { select: { name: fields.qualificationLevel } };
  }
  if (fields.doseSensitivity) {
    properties[P.doseSensitivity] = { select: { name: fields.doseSensitivity } };
  }
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.prefixes },
    properties,
  });
  return parsePage(page);
}

/** Wave 8.2 — fields revertable by the revisions panel. */
export const PREFIX_EDITABLE_FIELDS = Object.freeze([
  'prefix', 'regulatoryTier', 'displayOrder', 'notes',
  'evidenceType', 'qualificationLevel', 'doseSensitivity',
]);

export function isEditablePrefixField(fieldPath) {
  return PREFIX_EDITABLE_FIELDS.includes(fieldPath);
}

export async function updatePrefixField({ id, fieldPath, value, actor, reason }) {
  if (!id) throw new Error('updatePrefixField: id is required.');
  if (!isEditablePrefixField(fieldPath)) {
    const err = new Error(`updatePrefixField: fieldPath "${fieldPath}" is not editable via this endpoint.`);
    err.code = 'field-not-allowed';
    throw err;
  }
  return mutate({
    actor,
    entityType: REVISION_ENTITY_TYPES.CLAIM_PREFIX,
    entityId: id,
    fieldPath,
    reason,
    fetchCurrent: (entityId) => getPrefix(entityId),
    apply: () => updatePrefix(id, { [fieldPath]: value }),
  });
}

export async function updatePrefix(id, fields) {
  const properties = {};
  if (fields.prefix !== undefined) {
    properties[P.prefix] = { title: [{ text: { content: fields.prefix || '' } }] };
  }
  if (fields.regulatoryTier !== undefined) {
    properties[P.regulatoryTier] = fields.regulatoryTier
      ? { select: { name: fields.regulatoryTier } }
      : { select: null };
  }
  if (fields.displayOrder !== undefined) {
    properties[P.displayOrder] = { number: fields.displayOrder };
  }
  if (fields.notes !== undefined) {
    properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  }
  if (fields.evidenceType !== undefined) {
    properties[P.evidenceType] = fields.evidenceType
      ? { select: { name: fields.evidenceType } }
      : { select: null };
  }
  if (fields.qualificationLevel !== undefined) {
    properties[P.qualificationLevel] = fields.qualificationLevel
      ? { select: { name: fields.qualificationLevel } }
      : { select: null };
  }
  if (fields.doseSensitivity !== undefined) {
    properties[P.doseSensitivity] = fields.doseSensitivity
      ? { select: { name: fields.doseSensitivity } }
      : { select: null };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

export async function deletePrefix(id) {
  await notion.pages.update({ page_id: id, archived: true });
}

/**
 * Resolve a prefix by its text (case-insensitive trim match).
 * Returns the matching prefix row or null if not found.
 *
 * Used by the PDF import pipeline to map extracted prefix text
 * (e.g. "Supports") onto an existing Claim Prefixes row.
 */
export async function resolvePrefix(text) {
  if (!text || typeof text !== 'string') return null;
  const target = text.trim().toLowerCase();
  if (!target) return null;
  const all = await getAllPrefixes();
  return all.find(p => p.prefix.trim().toLowerCase() === target) || null;
}

// ─── Wave 7.0.5 T2 — cached dose-sensitivity lookup ──────────────────────────
//
// Prefix metadata changes rarely (a handful of rows, edited by admins).
// Callers that run during claim import need fast, non-blocking reads, so we
// cache the full prefix set in-memory for 60 s (same pattern as
// `require-admin-live.js`). Cache is keyed only by presence — on miss we
// hit Notion once and populate.

let _prefixCache = null;
let _prefixCacheExpires = 0;
const PREFIX_CACHE_TTL_MS = 60 * 1000;

async function _loadPrefixCache() {
  const now = Date.now();
  if (_prefixCache && _prefixCacheExpires > now) return _prefixCache;
  const all = await getAllPrefixes();
  _prefixCache = {
    byId: new Map(all.map(p => [p.id, p])),
    byIdNoDash: new Map(all.map(p => [p.id.replace(/-/g, ''), p])),
    all,
  };
  _prefixCacheExpires = now + PREFIX_CACHE_TTL_MS;
  return _prefixCache;
}

/** Reset the in-memory prefix cache. Intended for tests. */
export function _resetPrefixCache() {
  _prefixCache = null;
  _prefixCacheExpires = 0;
}

/**
 * Resolve a prefix page id → its `Dose sensitivity` select value.
 * Best-effort: returns `null` on any error or when the prefix has no
 * dose-sensitivity set (callers should fall back to `not_applicable`).
 */
export async function getPrefixDoseSensitivity(prefixId) {
  if (!prefixId || typeof prefixId !== 'string') return null;
  try {
    const cache = await _loadPrefixCache();
    const row =
      cache.byId.get(prefixId) ||
      cache.byIdNoDash.get(prefixId.replace(/-/g, '')) ||
      null;
    return row ? row.doseSensitivity || null : null;
  } catch (err) {
    // Callers treat a null as "unknown → omit dose from key"; never throw.
    // eslint-disable-next-line no-console
    console.warn('[pcs-prefixes] getPrefixDoseSensitivity failed:', err?.message || err);
    return null;
  }
}

