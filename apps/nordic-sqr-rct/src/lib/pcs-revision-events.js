/**
 * PCS Revision Events CRUD — audit trail for PCS document changes.
 *
 * Tracks file creation, modification, review & approve, and
 * substantiation evaluation events across PCS versions.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { getPcsSupabase, mirrorToPostgres, shouldUseStrongConsistency, shouldWriteToPostgresFirst, writePostgresFirst } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Day 2.7 column-name overrides for revision events.
// All camelCase keys map mechanically to snake_case; no exceptions.
const REVISION_EVENTS_PG_COLUMN_MAP = {};

const P = PROPS.revisionEvents;

/**
 * Notion select-option names cannot contain commas (hard API constraint).
 * Lauren's PCS template includes activity-type values like
 * "FC – Evaluate, Add to, &/or Revise Substantiation" verbatim. Sanitize
 * on the way in by swapping commas for " /" so the option name is valid
 * while preserving the original semantics visibly.
 */
function sanitizeSelectName(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/,\s*/g, ' / ').replace(/\s+\/\s+/g, ' / ').trim();
}

/**
 * 2026-05-06 — Path-2 Day 2.7. Mirror parsePage shape from a Postgres
 * pcs_revision_events row. Note: 001 modeled this table polymorphically
 * (entity_type/entity_id/before_value/after_value); 005 added the
 * narrative columns this app actually uses, and relaxed the polymorphic
 * NOT NULLs. We populate the narrative columns only.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    event: row.event || '',
    activityType: row.activity_type || null,
    responsibleDept: row.responsible_dept || null,
    responsibleIndividual: row.responsible_individual || null,
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    fromVersion: row.from_version || '',
    toVersion: row.to_version || '',
    fromVersionLinkedId: row.from_version_linked_id || null,
    toVersionLinkedId: row.to_version_linked_id || null,
    pcsVersionId: row.pcs_version_id || null,
    eventNotes: row.event_notes || '',
    approverAlias: row.approver_alias || '',
    approverDepartment: row.approver_department || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    event: p[P.event]?.title?.[0]?.plain_text || '',
    activityType: p[P.activityType]?.select?.name || null,
    responsibleDept: p[P.responsibleDept]?.select?.name || null,
    responsibleIndividual: (p[P.responsibleIndividual]?.rich_text || []).map(t => t.plain_text).join('') || null,
    startDate: p[P.startDate]?.date?.start || null,
    endDate: p[P.endDate]?.date?.start || null,
    fromVersion: (p[P.fromVersion]?.rich_text || []).map(t => t.plain_text).join(''),
    toVersion: (p[P.toVersion]?.rich_text || []).map(t => t.plain_text).join(''),
    fromVersionLinkedId: (p[P.fromVersionLinked]?.relation || [])[0]?.id || null,
    toVersionLinkedId: (p[P.toVersionLinked]?.relation || [])[0]?.id || null,
    pcsVersionId: (p[P.pcsVersion]?.relation || [])[0]?.id || null,
    eventNotes: (p[P.eventNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    // Lauren's template Table A dual-approval — added 2026-04-18
    approverAlias: (p[P.approverAlias]?.rich_text || []).map(t => t.plain_text).join(''),
    approverDepartment: p[P.approverDepartment]?.select?.name || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllRevisionEvents() {
  return await _fetchAllRevisionEventsFromPostgres();
}

async function _fetchAllRevisionEventsFromPostgres() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_revision_events')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getRevisionEvent(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_revision_events')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
}

export async function getEventsForVersion(versionId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_revision_events')
    .select('*')
    .eq('pcs_version_id', versionId)
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getEventsByActivityType(activityType) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_revision_events')
    .select('*')
    .eq('activity_type', activityType)
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getEventsByDepartment(dept) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_revision_events')
    .select('*')
    .eq('responsible_dept', dept)
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * 2026-05-06 — Path-2 Day 2.7 drift catcher. See pcs-evidence.js
 * syncRecentEvidenceToPostgres for the full pattern.
 */
export async function syncRecentRevisionEventsToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.revisionEvents,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_revision_events', parsed, REVISION_EVENTS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
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
export async function syncSingleRevisionEventPageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parsePage(page);
  return mirrorToPostgres('pcs_revision_events', parsed, REVISION_EVENTS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
}

export async function createRevisionEvent(fields) {
  const properties = {
    [P.event]: { title: [{ text: { content: fields.event } }] },
  };
  if (fields.activityType) properties[P.activityType] = { select: { name: sanitizeSelectName(fields.activityType) } };
  if (fields.responsibleDept) properties[P.responsibleDept] = { select: { name: sanitizeSelectName(fields.responsibleDept) } };
  if (fields.startDate) properties[P.startDate] = { date: { start: fields.startDate } };
  if (fields.endDate) properties[P.endDate] = { date: { start: fields.endDate } };
  if (fields.fromVersion) properties[P.fromVersion] = { rich_text: [{ text: { content: fields.fromVersion } }] };
  if (fields.toVersion) properties[P.toVersion] = { rich_text: [{ text: { content: fields.toVersion } }] };
  if (fields.pcsVersionId) properties[P.pcsVersion] = { relation: [{ id: fields.pcsVersionId }] };
  if (fields.fromVersionLinkedId) properties[P.fromVersionLinked] = { relation: [{ id: fields.fromVersionLinkedId }] };
  if (fields.toVersionLinkedId) properties[P.toVersionLinked] = { relation: [{ id: fields.toVersionLinkedId }] };
  if (fields.eventNotes) properties[P.eventNotes] = { rich_text: [{ text: { content: fields.eventNotes } }] };
  // Lauren's template Table A dual-approval
  if (fields.approverAlias) properties[P.approverAlias] = { rich_text: [{ text: { content: fields.approverAlias } }] };
  if (fields.approverDepartment) properties[P.approverDepartment] = { select: { name: sanitizeSelectName(fields.approverDepartment) } };

  if (shouldWriteToPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      event: fields.event || '',
      activityType: fields.activityType || null,
      responsibleDept: fields.responsibleDept || null,
      responsibleIndividual: fields.responsibleIndividual || null,
      startDate: fields.startDate || null,
      endDate: fields.endDate || null,
      fromVersion: fields.fromVersion || '',
      toVersion: fields.toVersion || '',
      fromVersionLinkedId: fields.fromVersionLinkedId || null,
      toVersionLinkedId: fields.toVersionLinkedId || null,
      pcsVersionId: fields.pcsVersionId || null,
      eventNotes: fields.eventNotes || '',
      approverAlias: fields.approverAlias || '',
      approverDepartment: fields.approverDepartment || null,
    };
    await writePostgresFirst('pcs_revision_events', stubRow, REVISION_EVENTS_PG_COLUMN_MAP);
    return stubRow;
  }
}

export async function updateRevisionEvent(id, fields) {
  const properties = {};
  if (fields.event !== undefined) {
    properties[P.event] = { title: [{ text: { content: fields.event } }] };
  }
  if (fields.activityType !== undefined) {
    properties[P.activityType] = fields.activityType
      ? { select: { name: sanitizeSelectName(fields.activityType) } }
      : { select: null };
  }
  if (fields.responsibleDept !== undefined) {
    properties[P.responsibleDept] = fields.responsibleDept
      ? { select: { name: sanitizeSelectName(fields.responsibleDept) } }
      : { select: null };
  }
  if (fields.startDate !== undefined) {
    properties[P.startDate] = fields.startDate ? { date: { start: fields.startDate } } : { date: null };
  }
  if (fields.endDate !== undefined) {
    properties[P.endDate] = fields.endDate ? { date: { start: fields.endDate } } : { date: null };
  }
  if (fields.eventNotes !== undefined) {
    properties[P.eventNotes] = { rich_text: [{ text: { content: fields.eventNotes } }] };
  }
  // Lauren's template Table A dual-approval — added 2026-04-18
  if (fields.approverAlias !== undefined) {
    properties[P.approverAlias] = { rich_text: [{ text: { content: fields.approverAlias || '' } }] };
  }
  if (fields.approverDepartment !== undefined) {
    properties[P.approverDepartment] = fields.approverDepartment
      ? { select: { name: fields.approverDepartment } }
      : { select: null };
  }
  if (shouldWriteToPostgresFirst()) {
    const stubRow = { id, ...fields };
    await writePostgresFirst('pcs_revision_events', stubRow, REVISION_EVENTS_PG_COLUMN_MAP);
    return stubRow;
  }
}
