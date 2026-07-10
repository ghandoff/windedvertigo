/**
 * PCS Requests CRUD — work queue items for PCS review cycles.
 *
 * Requests track RA/RES review workflows and link to PCS versions and claims.
 * Note: Status uses Notion's `status` property type (not `select`).
 */

import { PROPS } from './pcs-config.js';
import { getPcsSupabase, shouldWriteToPostgresFirst, writePostgresFirst } from './supabase-pcs.js';

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

export async function getAllRequests(maxPages = 50) { // eslint-disable-line no-unused-vars
  return await _fetchAllRequestsFromPostgres();
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
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_requests')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
}

export async function getRequestsByStatus(status) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_requests')
    .select('*')
    .eq('status', status)
    .order('ra_due', { ascending: true, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getRequestsForVersion(versionId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_requests')
    .select('*')
    .eq('pcs_version_id', versionId)
    .order('ra_due', { ascending: true, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getOpenRequests() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_requests')
    .select('*')
    .neq('status', 'Done')
    .order('ra_due', { ascending: true, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * Wave 4.5.1 — Get requests for a PCS Document (parent relation).
 * Optional `status` narrows by status; omit to include all.
 */
export async function getRequestsForDocument(documentId, { openOnly = false } = {}) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('[pcs-requests] Supabase not configured');
  let q = sb.from('pcs_requests').select('*').eq('related_pcs_id', documentId);
  if (openOnly) q = q.neq('status', 'Done');
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * Wave 4.5.1 — Unified query for the /pcs/requests UI.
 * filter: 'mine' | 'all' | 'aged' | 'critical'
 *
 * Server-side filters are applied where Notion supports them; `aged` (age > 14d)
 * is post-filtered after parse so the math is consistent with `ageDays`.
 */
export async function queryRequests({ filter = 'all', documentId, assigneeId, lastPingedBefore } = {}) {
  // 'mine' with no assigneeId: return empty (can't know who "me" is).
  if (filter === 'mine' && !assigneeId) return [];

  const sb = getPcsSupabase();
  if (!sb) throw new Error('[pcs-requests] Supabase not configured');
  let q = sb.from('pcs_requests').select('*');

  // Most filters exclude resolved. `all` in our UI means "all open".
  // Match "not Done" including rows with a null status.
  if (filter !== 'all' || !assigneeId) {
    q = q.or('status.is.null,status.neq.Done');
  }
  if (documentId) {
    q = q.eq('related_pcs_id', documentId);
  }
  if (filter === 'mine' && assigneeId) {
    q = q.contains('assignee_ids', [assigneeId]);
  }
  if (filter === 'critical') {
    q = q.in('priority', ['Safety', 'High']);
  }
  // Wave 4.5.3 — nightly re-ping stale filter. `lastPingedBefore` is a
  // YYYY-MM-DD cutoff. Matches rows where last_pinged_date is null (never
  // pinged) OR is on/before the cutoff date.
  if (lastPingedBefore) {
    q = q.or(`last_pinged_date.is.null,last_pinged_date.lte.${lastPingedBefore}`);
  }
  q = q.order('opened_date', { ascending: true, nullsFirst: false });

  const { data, error } = await q;
  if (error) throw error;

  let parsed = (data || []).map(parsePostgresRow);
  if (filter === 'aged') {
    parsed = parsed.filter(r => (r.ageDays ?? 0) > 14);
  }
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
  if (shouldWriteToPostgresFirst()) {
    const stubRow = { id, ...fields };
    await writePostgresFirst('pcs_requests', stripUnmirroredRequest(stubRow), REQUESTS_PG_COLUMN_MAP);
    return stubRow;
  }
}

/**
 * Wave 4.5.3 — Update only the `Last pinged date` on a Request. Used by the
 * nightly re-ping workflow after a successful Slack send so the step is
 * atomic (ping + update retry together).
 */
export async function updateRequestLastPinged(id, isoDate) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('[pcs-requests] Supabase not configured');
  const { data, error } = await sb
    .from('pcs_requests')
    .update({ last_pinged_date: isoDate })
    .eq('notion_page_id', id)
    .select('*')
    .single();
  if (error) throw error;
  return parsePostgresRow(data);
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

  if (shouldWriteToPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      request: fields.request || '',
      status: fields.status || null,
      requestedBy: fields.requestedBy || '',
      requestNotes: fields.requestNotes || '',
      pcsVersionId: fields.pcsVersionId || null,
      relatedClaimIds: fields.relatedClaimIds || [],
      raDue: fields.raDue || null,
      raCompleted: null,
      resDue: fields.resDue || null,
      resCompleted: null,
      relatedPcsId: fields.relatedPcsId || null,
      requestType: fields.requestType || null,
      specificField: fields.specificField || '',
      assignedRole: fields.assignedRole || null,
      assignees: [],
      assigneeIds: fields.assigneeIds || [],
      priority: fields.priority || null,
      openedDate: fields.openedDate || null,
      lastPingedDate: null,
      resolutionNote: '',
      source: fields.source || null,
      ageDays: null,
    };
    await writePostgresFirst('pcs_requests', stripUnmirroredRequest(stubRow), REQUESTS_PG_COLUMN_MAP);
    return stubRow;
  }
}
