/**
 * PCS Requests CRUD — work queue items for PCS review cycles.
 *
 * Requests track RA/RES review workflows and link to PCS versions and claims.
 * Note: Status uses Notion's `status` property type (not `select`).
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { getPcsSupabase, shouldReadFromPostgres, mirrorToPostgres, shouldUseStrongConsistency } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Day 2.7 column-name overrides for pcs_requests.
// All other camelCase keys map mechanically. The `assignees` field is
// the nested {id,name,email} array Notion returns — it has no flat
// Postgres column (intentional; see 005 migration notes — a join table
// is planned for Phase N1.5). Mirror writes strip it via
// stripUnmirroredFields() below.
const REQUESTS_PG_COLUMN_MAP = {};

// Fields parsePage() returns that don't have a Postgres column (yet).
// These are stripped from the row before mirroring so the upsert
// doesn't fail on an unknown column.
const REQUESTS_UNMIRRORED_FIELDS = new Set(['assignees']);

function stripUnmirroredRequest(parsed) {
  const out = {};
  for (const [k, v] of Object.entries(parsed || {})) {
    if (REQUESTS_UNMIRRORED_FIELDS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

const P = PROPS.requests;

function computeAgeDays(openedDate, createdTime) {
  const base = openedDate || (createdTime ? createdTime.slice(0, 10) : null);
  if (!base) return null;
  const then = new Date(base + 'T00:00:00Z').getTime();
  const now = Date.now();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now - then) / 86400000));
}

/**
 * 2026-05-06 — Path-2 Day 2.7. Convert a Postgres pcs_requests row
 * to parsePage shape. Note: 005 added the rich set of columns this
 * app uses (request, request_type, ra_due, etc.) on top of the 001
 * sparse skeleton (title/status/etc. — kept for backcompat). We
 * read from the 005 columns.
 *
 * `assignees` (nested {id,name,email}[]) cannot be reconstructed from
 * the flat assignee_ids TEXT[] column — return `[]` and the consumer
 * UI will render plain ids until the join table ships.
 */
function parsePostgresRow(row) {
  const openedDate = row.opened_date || null;
  const assigneeIds = row.assignee_ids || [];
  return {
    id: row.notion_page_id,
    request: row.request || '',
    status: row.status || null,
    requestedBy: row.requested_by || '',
    requestNotes: row.request_notes || '',
    pcsVersionId: row.pcs_version_id || null,
    relatedClaimIds: row.related_claim_ids || [],
    raDue: row.ra_due || null,
    raCompleted: row.ra_completed || null,
    resDue: row.res_due || null,
    resCompleted: row.res_completed || null,
    relatedPcsId: row.related_pcs_id || null,
    requestType: row.request_type || null,
    specificField: row.specific_field || '',
    assignedRole: row.assigned_role || null,
    // No nested object data in Postgres yet — flat ids only.
    assignees: assigneeIds.map(id => ({ id, name: null, email: null })),
    assigneeIds,
    priority: row.priority || null,
    openedDate,
    lastPingedDate: row.last_pinged_date || null,
    resolutionNote: row.resolution_note || '',
    source: row.source || null,
    ageDays: row.age_days ?? computeAgeDays(openedDate, row.notion_created_at),
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
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
  if (shouldReadFromPostgres()) {
    try {
      return await _fetchAllRequestsFromPostgres();
    } catch (err) {
      console.warn(`[pcs-requests] Postgres read failed, falling back to Notion: ${err.message}`);
    }
  }
  return _fetchAllRequestsFromNotion(maxPages);
}

async function _fetchAllRequestsFromNotion(maxPages) {
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

async function _fetchAllRequestsFromPostgres() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_requests')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getRequest(id) {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_requests')
        .select('*')
        .eq('notion_page_id', id)
        .maybeSingle();
      if (error) throw error;
      if (data) return parsePostgresRow(data);
    } catch (err) {
      console.warn(`[pcs-requests] Postgres single-row read failed, falling back to Notion: ${err.message}`);
    }
  }
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getRequestsByStatus(status) {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_requests')
        .select('*')
        .eq('status', status)
        .order('ra_due', { ascending: true, nullsFirst: false })
        .limit(5000);
      if (error) throw error;
      return (data || []).map(parsePostgresRow);
    } catch (err) {
      console.warn(`[pcs-requests] Postgres byStatus failed, falling back to Notion: ${err.message}`);
    }
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.requests,
    filter: { property: P.status, status: { equals: status } },
    sorts: [{ property: P.raDue, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getRequestsForVersion(versionId) {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_requests')
        .select('*')
        .eq('pcs_version_id', versionId)
        .order('ra_due', { ascending: true, nullsFirst: false })
        .limit(5000);
      if (error) throw error;
      return (data || []).map(parsePostgresRow);
    } catch (err) {
      console.warn(`[pcs-requests] Postgres forVersion failed, falling back to Notion: ${err.message}`);
    }
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.requests,
    filter: { property: P.pcsVersion, relation: { contains: versionId } },
    sorts: [{ property: P.raDue, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getOpenRequests() {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_requests')
        .select('*')
        .neq('status', 'Done')
        .order('ra_due', { ascending: true, nullsFirst: false })
        .limit(5000);
      if (error) throw error;
      return (data || []).map(parsePostgresRow);
    } catch (err) {
      console.warn(`[pcs-requests] Postgres open failed, falling back to Notion: ${err.message}`);
    }
  }
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
 * 2026-05-06 — Path-2 Day 2.7 drift catcher. See pcs-evidence.js
 * syncRecentEvidenceToPostgres for the full pattern.
 */
export async function syncRecentRequestsToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.requests,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres(
      'pcs_requests',
      stripUnmirroredRequest(parsed),
      REQUESTS_PG_COLUMN_MAP,
    );
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, maxSeen, fetched: res.results.length };
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
  const parsed = parsePage(page);
  await mirrorToPostgres('pcs_requests', stripUnmirroredRequest(parsed), REQUESTS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
  return parsed;
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
  const parsed = parsePage(page);
  await mirrorToPostgres('pcs_requests', stripUnmirroredRequest(parsed), REQUESTS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
  return parsed;
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
  const parsed = parsePage(page);
  await mirrorToPostgres('pcs_requests', stripUnmirroredRequest(parsed), REQUESTS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
  return parsed;
}
