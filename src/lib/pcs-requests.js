/**
 * PCS Requests CRUD — work queue items for PCS review cycles.
 *
 * Requests track RA/RES review workflows and link to PCS versions and claims.
 * Note: Status uses Notion's `status` property type (not `select`).
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.requests;

function computeAgeDays(openedDate, createdTime) {
  const base = openedDate || (createdTime ? createdTime.slice(0, 10) : null);
  if (!base) return null;
  const then = new Date(base + 'T00:00:00Z').getTime();
  const now = Date.now();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now - then) / 86400000));
}

function parsePage(page) {
  const p = page.properties;
  const openedDate = p[P.openedDate]?.date?.start || null;
  const assigneeList = (p[P.assignee]?.people || []).map(person => ({
    id: person.id,
    name: person.name || null,
    email: person.person?.email || null,
  }));
  return {
    id: page.id,
    request: p[P.request]?.title?.[0]?.plain_text || '',
    status: p[P.status]?.status?.name || null,
    // `requestedBy` is historically a people field on some deployments; coerce safely.
    requestedBy:
      (p[P.requestedBy]?.rich_text || []).map(t => t.plain_text).join('') ||
      (p[P.requestedBy]?.people || []).map(pp => pp.name || pp.id).join(', ') || '',
    requestNotes: (p[P.requestNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    pcsVersionId: (p[P.pcsVersion]?.relation || [])[0]?.id || null,
    relatedClaimIds: (p[P.relatedClaims]?.relation || []).map(r => r.id),
    raDue: p[P.raDue]?.date?.start || null,
    raCompleted: p[P.raCompleted]?.date?.start || null,
    resDue: p[P.resDue]?.date?.start || null,
    resCompleted: p[P.resCompleted]?.date?.start || null,
    // Wave 4.5.0 additions
    relatedPcsId: (p[P.relatedPcs]?.relation || [])[0]?.id || null,
    requestType: p[P.requestType]?.select?.name || null,
    specificField: (p[P.specificField]?.rich_text || []).map(t => t.plain_text).join(''),
    assignedRole: p[P.assignedRole]?.select?.name || null,
    assignees: assigneeList,
    assigneeIds: assigneeList.map(a => a.id),
    priority: p[P.priority]?.select?.name || null,
    openedDate,
    lastPingedDate: p[P.lastPingedDate]?.date?.start || null,
    resolutionNote: (p[P.resolutionNote]?.rich_text || []).map(t => t.plain_text).join(''),
    source: p[P.source]?.select?.name || null,
    ageDays: computeAgeDays(openedDate, page.created_time),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllRequests(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.requests,
      page_size: 100,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getRequest(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getRequestsByStatus(status) {
  const res = await notion.databases.query({
    database_id: PCS_DB.requests,
    filter: { property: P.status, status: { equals: status } },
    sorts: [{ property: P.raDue, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getRequestsForVersion(versionId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.requests,
    filter: { property: P.pcsVersion, relation: { contains: versionId } },
    sorts: [{ property: P.raDue, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getOpenRequests() {
  const res = await notion.databases.query({
    database_id: PCS_DB.requests,
    filter: {
      property: P.status,
      status: { does_not_equal: 'Done' },
    },
    sorts: [{ property: P.raDue, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

/**
 * Wave 4.5.1 — Get requests for a PCS Document (parent relation).
 * Optional `status` narrows by status; omit to include all.
 */
export async function getRequestsForDocument(documentId, { openOnly = false } = {}) {
  const filters = [{ property: P.relatedPcs, relation: { contains: documentId } }];
  if (openOnly) {
    filters.push({ property: P.status, status: { does_not_equal: 'Done' } });
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.requests,
    filter: filters.length === 1 ? filters[0] : { and: filters },
    page_size: 100,
  });
  return res.results.map(parsePage);
}

/**
 * Wave 4.5.1 — Unified query for the /pcs/requests UI.
 * filter: 'mine' | 'all' | 'aged' | 'critical'
 *
 * Server-side filters are applied where Notion supports them; `aged` (age > 14d)
 * is post-filtered after parse so the math is consistent with `ageDays`.
 */
export async function queryRequests({ filter = 'all', documentId, assigneeId, lastPingedBefore } = {}) {
  const and = [];
  // Most filters exclude resolved.
  if (filter !== 'all' || !assigneeId) {
    // 'all' in our UI means "all open" (Status != Done).
    and.push({ property: P.status, status: { does_not_equal: 'Done' } });
  }
  if (documentId) {
    and.push({ property: P.relatedPcs, relation: { contains: documentId } });
  }
  if (filter === 'mine' && assigneeId) {
    and.push({ property: P.assignee, people: { contains: assigneeId } });
  }
  if (filter === 'critical') {
    and.push({
      or: [
        { property: P.priority, select: { equals: 'Safety' } },
        { property: P.priority, select: { equals: 'High' } },
      ],
    });
  }
  // Wave 4.5.3 — nightly re-ping stale filter. `lastPingedBefore` is a
  // YYYY-MM-DD cutoff. Matches rows where `Last pinged date` is empty
  // (never pinged) OR is on/before the cutoff date.
  if (lastPingedBefore) {
    and.push({
      or: [
        { property: P.lastPingedDate, date: { is_empty: true } },
        { property: P.lastPingedDate, date: { on_or_before: lastPingedBefore } },
      ],
    });
  }

  const query = {
    database_id: PCS_DB.requests,
    page_size: 100,
    sorts: [{ property: P.openedDate, direction: 'ascending' }],
  };
  if (and.length === 1) query.filter = and[0];
  else if (and.length > 1) query.filter = { and };

  let all = [];
  let cursor;
  do {
    const res = await notion.databases.query({ ...query, start_cursor: cursor });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  let parsed = all.map(parsePage);
  if (filter === 'aged') {
    parsed = parsed.filter(r => (r.ageDays ?? 0) > 14);
  }
  // 'mine' with no assigneeId: return empty (can't know who "me" is).
  if (filter === 'mine' && !assigneeId) return [];
  return parsed;
}

export async function updateRequest(id, fields) {
  const properties = {};
  if (fields.request !== undefined) {
    properties[P.request] = { title: [{ text: { content: fields.request } }] };
  }
  if (fields.status !== undefined) {
    properties[P.status] = { status: { name: fields.status } };
  }
  if (fields.requestedBy !== undefined) {
    properties[P.requestedBy] = { rich_text: [{ text: { content: fields.requestedBy } }] };
  }
  if (fields.requestNotes !== undefined) {
    properties[P.requestNotes] = { rich_text: [{ text: { content: fields.requestNotes } }] };
  }
  if (fields.raDue !== undefined) {
    properties[P.raDue] = fields.raDue ? { date: { start: fields.raDue } } : { date: null };
  }
  if (fields.raCompleted !== undefined) {
    properties[P.raCompleted] = fields.raCompleted ? { date: { start: fields.raCompleted } } : { date: null };
  }
  if (fields.resDue !== undefined) {
    properties[P.resDue] = fields.resDue ? { date: { start: fields.resDue } } : { date: null };
  }
  if (fields.resCompleted !== undefined) {
    properties[P.resCompleted] = fields.resCompleted ? { date: { start: fields.resCompleted } } : { date: null };
  }
  // Wave 4.5.1 — resolution fields
  if (fields.resolutionNote !== undefined) {
    properties[P.resolutionNote] = { rich_text: [{ text: { content: String(fields.resolutionNote).slice(0, 1900) } }] };
  }
  if (fields.priority !== undefined) {
    properties[P.priority] = fields.priority ? { select: { name: fields.priority } } : { select: null };
  }
  if (fields.assignedRole !== undefined) {
    properties[P.assignedRole] = fields.assignedRole ? { select: { name: fields.assignedRole } } : { select: null };
  }
  if (fields.assigneeIds !== undefined) {
    properties[P.assignee] = {
      people: Array.isArray(fields.assigneeIds) ? fields.assigneeIds.map(uid => ({ id: uid })) : [],
    };
  }
  // Wave 4.6 — allow patching requestType + specificField. Used by
  // scripts/repair-pre-4.3.2-request-rows.mjs to heal rows created before the
  // Wave 4.3.2 fix to createRequest() added these properties on creation.
  if (fields.requestType !== undefined) {
    properties[P.requestType] = fields.requestType
      ? { select: { name: fields.requestType } }
      : { select: null };
  }
  if (fields.specificField !== undefined) {
    properties[P.specificField] = {
      rich_text: fields.specificField
        ? [{ text: { content: String(fields.specificField).slice(0, 400) } }]
        : [],
    };
  }
  // resolvedAt: we map to raCompleted OR resCompleted depending on role on close,
  // but callers may pass it explicitly; keep as a write-through to the role-appropriate
  // completion date. When status transitions to Done and no completion date is set,
  // caller should supply resolvedAt (YYYY-MM-DD).
  if (fields.resolvedAt !== undefined) {
    const date = fields.resolvedAt ? { date: { start: fields.resolvedAt } } : { date: null };
    // If caller indicated which side completed (via assignedRole), route accordingly.
    if (fields.assignedRole === 'RA') properties[P.raCompleted] = date;
    else if (fields.assignedRole === 'Research') properties[P.resCompleted] = date;
    else {
      // Default: populate both completion fields so either view surfaces it.
      properties[P.resCompleted] = date;
    }
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}

/**
 * Wave 4.5.3 — Update only the `Last pinged date` on a Request. Used by the
 * nightly re-ping workflow after a successful Slack send so the step is
 * atomic (ping + update retry together).
 */
export async function updateRequestLastPinged(id, isoDate) {
  const page = await notion.pages.update({
    page_id: id,
    properties: {
      [P.lastPingedDate]: { date: { start: isoDate } },
    },
  });
  return parsePage(page);
}

export async function createRequest(fields) {
  const properties = {
    [P.request]: { title: [{ text: { content: fields.request } }] },
  };
  if (fields.status) properties[P.status] = { status: { name: fields.status } };
  if (fields.requestedBy) properties[P.requestedBy] = { rich_text: [{ text: { content: fields.requestedBy } }] };
  if (fields.requestNotes) properties[P.requestNotes] = { rich_text: [{ text: { content: fields.requestNotes } }] };
  if (fields.pcsVersionId) properties[P.pcsVersion] = { relation: [{ id: fields.pcsVersionId }] };
  if (fields.relatedClaimIds?.length) {
    properties[P.relatedClaims] = { relation: fields.relatedClaimIds.map(id => ({ id })) };
  }
  if (fields.raDue) properties[P.raDue] = { date: { start: fields.raDue } };
  if (fields.resDue) properties[P.resDue] = { date: { start: fields.resDue } };
  // Wave 4.3.2 — forward request type + specific-field signal when provided so
  // claim-level "Request review" actions pre-populate the Notion row fully.
  if (fields.requestType) {
    properties[P.requestType] = { select: { name: fields.requestType } };
  }
  if (fields.specificField) {
    properties[P.specificField] = { rich_text: [{ text: { content: fields.specificField } }] };
  }

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.requests },
    properties,
  });
  return parsePage(page);
}
