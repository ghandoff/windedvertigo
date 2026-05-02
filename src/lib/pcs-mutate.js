/**
 * PCS mutate wrapper — Wave 8 Phase A
 *
 * Every entity-helper mutation (update / create / delete) routes through
 * mutate() so we capture a before/after snapshot and emit a PCS Revisions
 * row. Usage:
 *
 *   const updated = await mutate({
 *     actor: { email, roles },         // required unless strict:false + cron path
 *     entityType: 'canonical_claim',
 *     entityId: 'notion-page-id',
 *     fieldPath: 'prefix',             // or 'bulk' for multi-field writes
 *     reason: 'Gina merged duplicate clusters 2-4',
 *     fetchCurrent: async (id) => getCanonicalClaim(id),   // returns current state
 *     apply:        async (before) => updateCanonicalClaim(id, changes), // performs the write
 *   });
 *
 * Fails-closed by default: if the revision write fails, the caller's
 * mutation is aborted (NOT rolled back — Notion has no transactions — but
 * the caller sees the error and can decide how to handle). Cron paths that
 * need the mutation to land even if revision log is unreachable pass
 * `{ strict: false }`, which downgrades the log failure to a console.warn.
 */

import { logRevision } from './pcs-revisions.js';
import { SYSTEM_ACTOR_EMAIL } from './pcs-config.js';

/**
 * @param {object} args
 * @param {object} [args.actor]         - { email, roles } — falls back to system
 * @param {string}  args.entityType     - canonical identifier
 * @param {string}  args.entityId       - Notion page ID
 * @param {string} [args.entityTitle]   - denormalized label
 * @param {string} [args.fieldPath]     - dotted path; defaults to 'bulk'
 * @param {string} [args.reason]        - optional operator note
 * @param {Function} args.fetchCurrent  - async (id) => current entity state (any JSON-serializable shape)
 * @param {Function} args.apply         - async (before) => result (the actual Notion write)
 * @param {boolean} [args.strict=true]  - if false, log failures are warnings not errors
 * @returns {Promise<*>} the result of apply()
 */
export async function mutate({
  actor,
  entityType,
  entityId,
  entityTitle,
  fieldPath = 'bulk',
  reason,
  fetchCurrent,
  apply,
  strict = true,
}) {
  if (!entityType) throw new Error('mutate: entityType is required.');
  if (!entityId) throw new Error('mutate: entityId is required.');
  if (typeof fetchCurrent !== 'function') throw new Error('mutate: fetchCurrent must be a function.');
  if (typeof apply !== 'function') throw new Error('mutate: apply must be a function.');

  const effectiveActor = actor || { email: SYSTEM_ACTOR_EMAIL, roles: ['system'] };

  // Snapshot before.
  let before = null;
  try {
    before = await fetchCurrent(entityId);
  } catch (err) {
    // If we can't read the current state, we can't produce a clean
    // before-value. Log it and proceed with null — the mutation may still
    // be valid (e.g. create operations have no meaningful before).
    console.warn(`[mutate] fetchCurrent failed for ${entityType}:${entityId}: ${err?.message || err}`);
  }

  // Perform the write.
  const result = await apply(before);

  // Snapshot after.
  let after = null;
  try {
    after = await fetchCurrent(entityId);
  } catch (err) {
    console.warn(`[mutate] post-write fetchCurrent failed for ${entityType}:${entityId}: ${err?.message || err}`);
    after = result; // best-effort fallback
  }

  // Emit revision.
  try {
    await logRevision({
      actor: effectiveActor,
      entityType,
      entityId,
      entityTitle: entityTitle || after?.title || after?.name || undefined,
      fieldPath,
      before: extractForField(before, fieldPath),
      after: extractForField(after, fieldPath),
      reason,
    });
  } catch (err) {
    const msg = `[mutate] revision log write failed for ${entityType}:${entityId} (field=${fieldPath}): ${err?.message || err}`;
    if (strict) {
      const wrapped = new Error(msg);
      wrapped.cause = err;
      throw wrapped;
    }
    console.warn(msg);
  }

  return result;
}

/**
 * Narrow a before/after snapshot down to just the field(s) that changed.
 * - If fieldPath === 'bulk', return the whole object (capped at 1950 via
 *   the downstream JSON truncation in pcs-revisions.js).
 * - If fieldPath is a dotted path, drill in. Missing keys return undefined.
 */
function extractForField(snapshot, fieldPath) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  if (!fieldPath || fieldPath === 'bulk' || fieldPath === 'create' || fieldPath === 'delete') {
    return snapshot;
  }
  const parts = fieldPath.split('.');
  let cursor = snapshot;
  for (const key of parts) {
    if (cursor == null) return undefined;
    const num = Number(key);
    cursor = Array.isArray(cursor) && !Number.isNaN(num)
      ? cursor[num]
      : cursor[key];
  }
  return cursor;
}
