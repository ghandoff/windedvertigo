/**
 * PCS Revisions — Wave 8 Phase A; Postgres-first as of Tier-2 PR #7 (2026-05-23).
 *
 * Every mutation that lands via the PCS API layer writes a row here:
 * who did it, when, which entity, which field, before/after values.
 * This is the platform's immutable audit trail; it's also the source a
 * super-user reverts from when a bad edit lands.
 *
 * Storage: `pcs_revision_events` Supabase table (extended in migration 015
 * with the audit fields actor_roles / entity_title / reverted_at /
 * reverted_by / revert_of_revision). Notion is mirrored fire-and-forget.
 *
 * Fails-closed discipline: by default, if the Postgres revision log
 * write errors, the caller's mutation is aborted. Callers that explicitly
 * want a soft log (cron paths) opt in via `{ strict: false }` on the
 * mutate() wrapper.
 */

import { notion } from './notion.js';
import { PCS_DB, PROPS, SYSTEM_ACTOR_EMAIL } from './pcs-config.js';
import { getPcsSupabase } from './supabase-pcs.js';

const R = PROPS.revisions;
const MAX_VALUE_CHARS = 1950;

function truncate(str, n = MAX_VALUE_CHARS) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function jsonOrNull(value) {
  if (value === undefined || value === null) return null;
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return truncate(String(value));
  }
}

function composeTitle({ entityType, entityId, fieldPath, timestamp, actorEmail }) {
  const shortId = (entityId || 'unknown').replace(/-/g, '').slice(-8);
  const when = timestamp
    ? new Date(timestamp).toISOString().replace('T', ' ').slice(0, 16) + 'Z'
    : '—';
  const actor = (actorEmail || '').split('@')[0] || 'unknown';
  return `${entityType} · ${shortId} · ${fieldPath || 'bulk'} · ${when} · ${actor}`;
}

function toTextProperty(value) {
  const v = value == null ? '' : String(value);
  if (!v) return { rich_text: [] };
  return { rich_text: [{ text: { content: truncate(v) } }] };
}

// ─── Parse ──────────────────────────────────────────────────────────────

function parsePostgresRow(row) {
  return {
    id: row.notion_page_id || row.id,
    createdTime: row.notion_created_at || row.created_at,
    title: composeTitle({
      entityType: row.entity_type,
      entityId: row.entity_id,
      fieldPath: row.field_path,
      timestamp: row.notion_created_at || row.created_at,
      actorEmail: row.actor,
    }),
    timestamp: row.notion_created_at || row.created_at,
    actorEmail: row.actor || null,
    actorRoles: row.actor_roles || [],
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    entityTitle: row.entity_title || null,
    fieldPath: row.field_path || null,
    beforeValue: row.before_value != null ? (typeof row.before_value === 'string' ? row.before_value : JSON.stringify(row.before_value)) : null,
    afterValue: row.after_value != null ? (typeof row.after_value === 'string' ? row.after_value : JSON.stringify(row.after_value)) : null,
    reason: row.reason || null,
    revertedAt: row.reverted_at || null,
    revertedBy: row.reverted_by || null,
    revertOfRevision: row.revert_of_revision || null,
  };
}

export function parseRevisionPage(page) {
  const p = page.properties || {};
  const getText = (prop) => (prop?.rich_text || []).map(t => t.plain_text).join('') || null;
  return {
    id: page.id,
    createdTime: page.created_time,
    title: p[R.title]?.title?.[0]?.plain_text || '',
    timestamp: p[R.timestamp]?.date?.start || null,
    actorEmail: p[R.actorEmail]?.email || null,
    actorRoles: (p[R.actorRoles]?.multi_select || []).map(s => s.name),
    entityType: p[R.entityType]?.select?.name || null,
    entityId: getText(p[R.entityId]),
    entityTitle: getText(p[R.entityTitle]),
    fieldPath: getText(p[R.fieldPath]),
    beforeValue: getText(p[R.beforeValue]),
    afterValue: getText(p[R.afterValue]),
    reason: getText(p[R.reason]),
    revertedAt: p[R.revertedAt]?.date?.start || null,
    revertedBy: p[R.revertedBy]?.email || null,
    revertOfRevision: getText(p[R.revertOfRevision]),
  };
}

// ─── Writes — Postgres-first, Notion fire-and-forget mirror ─────────────

/**
 * Write one revision row.
 *
 * @param {object} args
 * @param {object} args.actor - { email, roles }
 * @param {string} args.entityType
 * @param {string} args.entityId
 * @param {string} [args.entityTitle]
 * @param {string} [args.fieldPath]
 * @param {*}      [args.before]
 * @param {*}      [args.after]
 * @param {string} [args.reason]
 * @param {string} [args.revertOfRevision]
 * @returns {Promise<{id: string}>}
 */
export async function logRevision({
  actor,
  entityType,
  entityId,
  entityTitle,
  fieldPath,
  before,
  after,
  reason,
  revertOfRevision,
}) {
  if (!entityType) throw new Error('logRevision: entityType is required.');
  if (!entityId) throw new Error('logRevision: entityId is required.');

  const actorEmail = actor?.email || SYSTEM_ACTOR_EMAIL;
  const actorRoles = Array.isArray(actor?.roles) && actor.roles.length > 0
    ? actor.roles
    : ['system'];
  const timestamp = new Date().toISOString();
  const newId = crypto.randomUUID();

  // Postgres-canonical write.
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured (revisions require a writable backend)');

  const row = {
    notion_page_id: newId,
    entity_type: entityType,
    entity_id: String(entityId),
    field_path: fieldPath || 'bulk',
    before_value: before === undefined ? null : before,
    after_value: after === undefined ? null : after,
    actor: actorEmail,
    actor_roles: actorRoles,
    entity_title: entityTitle || null,
    reason: reason || '',
    revert_of_revision: revertOfRevision || null,
    notion_created_at: timestamp,
    notion_last_edited_at: timestamp,
  };

  const { error } = await sb.from('pcs_revision_events').insert(row);
  if (error) throw new Error(`Revision insert failed: ${error.message}`);

  // Notion mirror (legacy).
  if (PCS_DB.revisions) {
    const properties = {
      [R.title]: { title: [{ text: { content: composeTitle({ entityType, entityId, fieldPath, timestamp, actorEmail }) } }] },
      [R.timestamp]: { date: { start: timestamp } },
      [R.actorEmail]: { email: actorEmail },
      [R.actorRoles]: { multi_select: actorRoles.map(name => ({ name })) },
      [R.entityType]: { select: { name: entityType } },
      [R.entityId]: { rich_text: [{ text: { content: String(entityId) } }] },
      [R.entityTitle]: toTextProperty(entityTitle),
      [R.fieldPath]: toTextProperty(fieldPath || 'bulk'),
      [R.beforeValue]: toTextProperty(jsonOrNull(before)),
      [R.afterValue]: toTextProperty(jsonOrNull(after)),
      [R.reason]: toTextProperty(reason),
    };
    if (revertOfRevision) properties[R.revertOfRevision] = toTextProperty(revertOfRevision);
    notion.pages
      .create({ parent: { database_id: PCS_DB.revisions }, properties })
      .catch(() => { /* Part 10 — Notion no longer canonical */ });
  }

  return { id: newId };
}

// ─── Reads — Postgres-first ─────────────────────────────────────────────

export async function getRevisions({ entityId, entityType, limit = 50 } = {}) {
  if (!entityId) throw new Error('getRevisions: entityId is required.');

  const sb = getPcsSupabase();
  if (sb) {
    let q = sb
      .from('pcs_revision_events')
      .select('*')
      .eq('entity_id', String(entityId))
      .order('notion_created_at', { ascending: false, nullsFirst: false })
      .limit(Math.min(limit, 100));
    if (entityType) q = q.eq('entity_type', entityType);
    const { data, error } = await q;
    if (!error) return (data || []).map(parsePostgresRow);
    console.warn('[pcs-revisions] Postgres read failed, falling back to Notion:', error.message);
  }

  // Notion fallback.
  if (!PCS_DB.revisions) return [];
  const filter = {
    and: [
      { property: R.entityId, rich_text: { equals: String(entityId) } },
      ...(entityType ? [{ property: R.entityType, select: { equals: entityType } }] : []),
    ],
  };
  const res = await notion.databases.query({
    database_id: PCS_DB.revisions,
    filter,
    sorts: [{ property: R.timestamp, direction: 'descending' }],
    page_size: Math.min(limit, 100),
  });
  return res.results.map(parseRevisionPage);
}

export async function getRevisionById(id) {
  if (!id) return null;
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_revision_events')
      .select('*')
      .eq('notion_page_id', id)
      .maybeSingle();
    if (!error && data) return parsePostgresRow(data);
  }
  if (!PCS_DB.revisions) return null;
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    return parseRevisionPage(page);
  } catch {
    return null;
  }
}

/**
 * Mark a revision as reverted. Postgres-first; Notion mirror fire-and-forget.
 */
export async function markRevisionReverted({ revisionId, actor, reason, newRevisionId }) {
  if (!revisionId) throw new Error('markRevisionReverted: revisionId is required.');
  const revertedAt = new Date().toISOString();
  const revertedBy = actor?.email || SYSTEM_ACTOR_EMAIL;

  const sb = getPcsSupabase();
  if (sb) {
    const update = {
      reverted_at: revertedAt,
      reverted_by: revertedBy,
      notion_last_edited_at: revertedAt,
    };
    if (reason) update.reason = `[reverted ${revertedAt} by ${revertedBy}] ${reason}`;
    if (newRevisionId) update.revert_of_revision = newRevisionId;
    const { error } = await sb.from('pcs_revision_events').update(update).eq('notion_page_id', revisionId);
    if (error) throw new Error(`Revert mark failed: ${error.message}`);
  }

  // Notion mirror (legacy).
  if (PCS_DB.revisions) {
    const properties = {
      [R.revertedAt]: { date: { start: revertedAt } },
      [R.revertedBy]: { email: revertedBy },
    };
    if (reason) {
      properties[R.reason] = toTextProperty(`[reverted ${revertedAt} by ${revertedBy}] ${reason}`);
    }
    if (newRevisionId) properties[R.revertOfRevision] = toTextProperty(newRevisionId);
    notion.pages
      .update({ page_id: revisionId, properties })
      .catch(() => { /* Part 10 — Notion no longer canonical */ });
  }

  return { revertedRevisionId: revisionId, newRevisionId: newRevisionId || null };
}
