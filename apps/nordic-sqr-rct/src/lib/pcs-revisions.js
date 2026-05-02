/**
 * PCS Revisions — Wave 8 Phase A
 *
 * Every mutation that lands in Notion via the PCS API layer writes a row
 * here: who did it, when, which entity, which field, before/after values.
 * This is the platform's immutable audit trail; it's also the source a
 * super-user reverts from when a bad edit lands.
 *
 * Fails-closed discipline: by default, if the revision log write errors,
 * the caller's mutation is aborted. Callers that explicitly want a soft
 * log (cron paths where we'd rather lose the audit row than lose the
 * mutation) opt in via `{ strict: false }` on the mutate() wrapper.
 *
 * Design notes:
 *   - Page titles are auto-composed so the Notion list view is scannable.
 *   - Before/after JSON is truncated to 1950 chars (Wave 5.3.1 pattern —
 *     Notion's hard rich_text limit is 2000 chars per chunk; a single
 *     chunk keeps serialization simple and forecast-able).
 *   - We never query across the whole revisions table in the hot path;
 *     reads are always keyed by `entity_id` via a Notion filter.
 */

import { notion } from './notion.js';
import { PCS_DB, PROPS, SYSTEM_ACTOR_EMAIL } from './pcs-config.js';

const R = PROPS.revisions;
const MAX_VALUE_CHARS = 1950;

function truncate(str, n = MAX_VALUE_CHARS) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '\u2026' : str;
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

function parseRevisionPage(page) {
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

/**
 * Write one revision row to Notion.
 *
 * @param {object} args
 * @param {object} args.actor - { email, roles } — identity of the actor
 * @param {string} args.entityType - canonical identifier from REVISION_ENTITY_TYPES
 * @param {string} args.entityId - Notion page ID of the edited row
 * @param {string} [args.entityTitle] - denormalized label for fast listing
 * @param {string} [args.fieldPath] - dotted path or 'bulk' / 'create' / 'delete'
 * @param {*}      [args.before] - prior value (will be JSON-stringified + truncated)
 * @param {*}      [args.after]  - new value (same)
 * @param {string} [args.reason] - optional operator note
 * @param {string} [args.revertOfRevision] - if this is a revert, the revision id it undoes
 * @returns {Promise<{id: string}>} the created revision page id
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
  if (!PCS_DB.revisions) {
    throw new Error('NOTION_PCS_REVISIONS_DB env var is not set.');
  }
  if (!entityType) throw new Error('logRevision: entityType is required.');
  if (!entityId) throw new Error('logRevision: entityId is required.');

  const actorEmail = actor?.email || SYSTEM_ACTOR_EMAIL;
  const actorRoles = Array.isArray(actor?.roles) && actor.roles.length > 0
    ? actor.roles
    : ['system'];
  const timestamp = new Date().toISOString();

  const properties = {
    [R.title]: {
      title: [{ text: { content: composeTitle({ entityType, entityId, fieldPath, timestamp, actorEmail }) } }],
    },
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
  if (revertOfRevision) {
    properties[R.revertOfRevision] = toTextProperty(revertOfRevision);
  }

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.revisions },
    properties,
  });
  return { id: page.id };
}

/**
 * List revisions for an entity, newest first. Cheap Notion filter by entity_id.
 *
 * @param {object} args
 * @param {string} args.entityId - required
 * @param {string} [args.entityType] - optional filter
 * @param {number} [args.limit=50]
 */
export async function getRevisions({ entityId, entityType, limit = 50 } = {}) {
  if (!entityId) throw new Error('getRevisions: entityId is required.');
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

/** Single revision by id. */
export async function getRevisionById(id) {
  if (!id) return null;
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    return parseRevisionPage(page);
  } catch {
    return null;
  }
}

/**
 * Mark a revision as reverted. Does NOT itself revert the entity — callers
 * should write the entity first (via the relevant entity helper), then call
 * this with the revision id + actor + reason. A separate "this is the
 * revert entry" revision is also created so the undo action itself is
 * audited.
 *
 * @returns {Promise<{ revertedRevisionId: string, newRevisionId: string }>}
 */
export async function markRevisionReverted({ revisionId, actor, reason, newRevisionId }) {
  if (!revisionId) throw new Error('markRevisionReverted: revisionId is required.');
  const revertedAt = new Date().toISOString();
  const properties = {
    [R.revertedAt]: { date: { start: revertedAt } },
    [R.revertedBy]: { email: actor?.email || SYSTEM_ACTOR_EMAIL },
  };
  // Annotate the reason by appending a revert-line to the existing reason
  // (if any). Keep it short to stay under the 1950-char limit.
  if (reason) {
    const stamped = `[reverted ${revertedAt} by ${actor?.email || SYSTEM_ACTOR_EMAIL}] ${reason}`;
    properties[R.reason] = toTextProperty(stamped);
  }
  if (newRevisionId) {
    // Cross-link: the reverted row now points at the revision that undid it.
    // The undoing revision (created separately via logRevision with
    // revertOfRevision set to the source id) already points the other way.
    properties[R.revertOfRevision] = toTextProperty(newRevisionId);
  }
  await notion.pages.update({ page_id: revisionId, properties });
  return { revertedRevisionId: revisionId, newRevisionId: newRevisionId || null };
}

export { parseRevisionPage };
