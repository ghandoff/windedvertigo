/**
 * PCS Revision Events CRUD — audit trail for PCS document changes.
 *
 * Tracks file creation, modification, review & approve, and
 * substantiation evaluation events across PCS versions.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


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
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.revisionEvents,
      start_cursor: cursor,
      sorts: [{ property: P.startDate, direction: 'descending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getRevisionEvent(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getEventsForVersion(versionId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.revisionEvents,
    filter: { property: P.pcsVersion, relation: { contains: versionId } },
    sorts: [{ property: P.startDate, direction: 'descending' }],
  });
  return res.results.map(parsePage);
}

export async function getEventsByActivityType(activityType) {
  const res = await notion.databases.query({
    database_id: PCS_DB.revisionEvents,
    filter: { property: P.activityType, select: { equals: activityType } },
    sorts: [{ property: P.startDate, direction: 'descending' }],
  });
  return res.results.map(parsePage);
}

export async function getEventsByDepartment(dept) {
  const res = await notion.databases.query({
    database_id: PCS_DB.revisionEvents,
    filter: { property: P.responsibleDept, select: { equals: dept } },
    sorts: [{ property: P.startDate, direction: 'descending' }],
  });
  return res.results.map(parsePage);
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

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.revisionEvents },
    properties,
  });
  return parsePage(page);
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
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}
