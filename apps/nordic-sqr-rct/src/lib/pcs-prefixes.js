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
import { getPcsSupabase, mirrorToPostgres, shouldUseStrongConsistency, shouldWriteToPostgresFirst, writePostgresFirst } from './supabase-pcs.js';


const P = PROPS.prefixes;

// ── Postgres path (Part 10 migration) ────────────────────────────────────────
const PREFIXES_PG_COLUMN_MAP = {
  regulatoryTier: 'regulatory_tier',
  displayOrder: 'display_order',
  evidenceType: 'evidence_type',
  qualificationLevel: 'qualification_level',
  doseSensitivity: 'dose_sensitivity',
  createdTime: 'notion_created_at',
  lastEditedTime: 'notion_last_edited_at',
};

function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    prefix: row.prefix || '',
    regulatoryTier: row.regulatory_tier || null,
    displayOrder: row.display_order ?? null,
    notes: row.notes || '',
    evidenceType: row.evidence_type || null,
    qualificationLevel: row.qualification_level || null,
    doseSensitivity: row.dose_sensitivity || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

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
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_prefixes')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .limit(1000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getPrefix(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_prefixes')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
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
  if (shouldWriteToPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      prefix: fields.prefix || '',
      regulatoryTier: fields.regulatoryTier || null,
      displayOrder: fields.displayOrder ?? null,
      notes: fields.notes || '',
      evidenceType: fields.evidenceType || null,
      qualificationLevel: fields.qualificationLevel || null,
      doseSensitivity: fields.doseSensitivity || null,
    };
    await writePostgresFirst('pcs_prefixes', stubRow, PREFIXES_PG_COLUMN_MAP);
    return stubRow;
  }
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
  if (shouldWriteToPostgresFirst()) {
    const stubRow = { id, ...fields };
    await writePostgresFirst('pcs_prefixes', stubRow, PREFIXES_PG_COLUMN_MAP);
    return stubRow;
  }
}

export async function deletePrefix(id) {
  if (shouldWriteToPostgresFirst()) {
    const sb = getPcsSupabase();
    await sb.from('pcs_prefixes').delete().eq('notion_page_id', id);
    return;
  }
}

// ── Drift-sync helpers (used by cron until Phase F retire) ────────────────────
export async function syncRecentPrefixesToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.prefixes,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_prefixes', parsed, PREFIXES_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, maxSeen, fetched: res.results.length };
}

export async function syncSinglePrefixPageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parsePage(page);
  return mirrorToPostgres('pcs_prefixes', parsed, PREFIXES_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
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

