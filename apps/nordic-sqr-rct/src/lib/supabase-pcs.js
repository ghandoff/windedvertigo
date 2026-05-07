/**
 * Server-only Supabase client for the PCS Postgres mirror.
 *
 * Path-2 read-path infrastructure (2026-05-06). The wv-nordic Supabase
 * project mirrors all Notion PCS data; this client gives the lib helpers
 * a single shared connection for read paths (and later, dual-writes in
 * Phase B).
 *
 * Returns null when env isn't configured — every caller MUST handle the
 * null case and fall back to Notion. That fallback is what makes
 * PCS_READ_FROM_POSTGRES safe to flip without breaking production.
 *
 * Sibling: src/lib/supabase-safety.js (the safety-saga client). Kept
 * separate because they may eventually run against different projects
 * and they have distinct invalidation semantics.
 */

import { createClient } from '@supabase/supabase-js';

let _client = null;

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getPcsSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_NORDIC_URL;
  // Prefer the new sb_secret_* format; fall back to legacy JWT keys
  // if a user has re-enabled them temporarily.
  const key =
    process.env.SUPABASE_NORDIC_SECRET_KEY ||
    process.env.SUPABASE_NORDIC_SERVICE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });
  return _client;
}

/**
 * True when the read-from-Postgres feature flag is on AND the client is
 * configured. Helpers gate their Postgres path on this — anything false
 * falls back to the Notion implementation.
 *
 * Set `PCS_READ_FROM_POSTGRES=1` in Vercel to enable. Turn off by
 * removing the env var (or setting it to anything other than `1` /
 * `true`). No deploy needed to flip — just `vercel env add` + the next
 * cold-start picks it up.
 */
export function shouldReadFromPostgres() {
  const flag = process.env.PCS_READ_FROM_POSTGRES;
  if (flag !== '1' && flag !== 'true') return false;
  return getPcsSupabase() !== null;
}

/**
 * 2026-05-06 — Path-2 Phase A write-mirror.
 *
 * After every Notion write (create/update), call this with the parsed
 * Notion-shape row to mirror it into Postgres. Best-effort: never
 * throws back to the user-facing operation. Failures log a warning and
 * are picked up later by the drift-detection cron.
 *
 * Phase A is eventual-consistency: the user's edit lands in Notion
 * (canonical) and we mirror it to Postgres immediately for read-path
 * freshness. Phase B inverts this — Postgres becomes canonical and
 * Notion becomes the mirror.
 *
 * @param {string} table — Postgres table name (e.g. 'pcs_evidence')
 * @param {object} parsedNotionRow — the result of parsePage() from
 *                                    a pcs-*.js helper
 * @param {object} columnMap — { notionShapeKey: 'pg_column_name' } for
 *                              fields that don't follow camelCase →
 *                              snake_case. e.g. {pdf: 'pdf_url'}.
 *                              Pass {} if no overrides.
 */
export async function mirrorToPostgres(
  table,
  parsedNotionRow,
  columnMap = {},
  { enqueueOnFailure = false } = {},
) {
  // Skip if Postgres isn't configured at all (local dev, env unset).
  // Different from `shouldReadFromPostgres` — we mirror regardless of
  // the read flag, because Postgres needs to stay fresh either way.
  const sb = getPcsSupabase();
  if (!sb) return { mirrored: false, reason: 'not_configured' };

  try {
    const row = notionShapeToPgRow(parsedNotionRow, columnMap);
    const { error } = await sb
      .from(table)
      .upsert(row, { onConflict: 'notion_page_id' });
    if (error) throw error;
    return { mirrored: true };
  } catch (err) {
    console.warn(
      `[supabase-pcs] mirror to ${table} failed for ${parsedNotionRow?.id}: ${err.message}`,
    );
    if (enqueueOnFailure) {
      await enqueuePendingWrite({
        table,
        parsedNotionRow,
        columnMap,
        error: err.message,
      });
    }
    return { mirrored: false, reason: err.message };
  }
}

/**
 * 2026-05-06 — Path-2 Phase B Bundle 1.
 *
 * Strong-consistency retry queue: when a mirror write fails after a
 * successful Notion write, enqueue here so the retry-pending-writes
 * cron can re-attempt later. Idempotent on (pg_table, notion_page_id):
 * a duplicate enqueue bumps `attempts` + refreshes `last_error`.
 *
 * Best-effort itself — if even the queue insert fails, we log and
 * return silently. At that point Postgres availability is so degraded
 * that the next drift-cron pass will catch the row anyway via
 * Notion last_edited_time watermark.
 */
export async function enqueuePendingWrite({
  table,
  parsedNotionRow,
  columnMap = {},
  error,
}) {
  const sb = getPcsSupabase();
  if (!sb) return { enqueued: false, reason: 'not_configured' };
  const notionPageId = parsedNotionRow?.id;
  if (!notionPageId) {
    console.warn(
      `[supabase-pcs] enqueuePendingWrite skipped: missing notion id (table=${table})`,
    );
    return { enqueued: false, reason: 'no_notion_id' };
  }

  try {
    // Stash the column-map alongside the parsed row so the retry worker
    // can re-run mirrorToPostgres with identical mapping semantics.
    const payload = { row: parsedNotionRow, columnMap };
    // Look for an existing unresolved row first — if present, bump
    // attempts; otherwise insert a fresh one. Two round-trips, but
    // this is the failure path so we prioritise correctness over speed.
    const { data: existing, error: selErr } = await sb
      .from('pcs_pending_writes')
      .select('id, attempts')
      .eq('pg_table', table)
      .eq('notion_page_id', notionPageId)
      .is('succeeded_at', null)
      .maybeSingle();
    if (selErr) {
      console.warn(
        `[supabase-pcs] enqueuePendingWrite select failed for ${table}/${notionPageId}: ${selErr.message}`,
      );
      return { enqueued: false, reason: selErr.message };
    }
    if (existing) {
      const { error: bumpErr } = await sb
        .from('pcs_pending_writes')
        .update({
          attempts: (existing.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: error || null,
          payload,
        })
        .eq('id', existing.id);
      if (bumpErr) return { enqueued: false, reason: bumpErr.message };
      return { enqueued: true, bumped: true };
    }
    const { error: insertErr } = await sb.from('pcs_pending_writes').insert({
      pg_table: table,
      notion_page_id: notionPageId,
      payload,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
      last_error: error || null,
    });
    if (insertErr) return { enqueued: false, reason: insertErr.message };
    return { enqueued: true, bumped: false };
  } catch (err) {
    console.warn(
      `[supabase-pcs] enqueuePendingWrite failed for ${table}/${notionPageId}: ${err.message}`,
    );
    return { enqueued: false, reason: err.message };
  }
}

/**
 * 2026-05-06 — Path-2 Phase B Bundle 1.
 *
 * True only when the strong-consistency feature flag is on AND the
 * Postgres mirror client is configured. When false, helpers fall
 * back to Phase A best-effort (mirror failures are logged but not
 * queued). Flip via `PCS_STRONG_CONSISTENCY=1` in Vercel env.
 */
export function shouldUseStrongConsistency() {
  const flag = process.env.PCS_STRONG_CONSISTENCY;
  if (flag !== '1' && flag !== 'true') return false;
  return getPcsSupabase() !== null;
}

/**
 * 2026-05-06 — Path-2 Phase B canonical write.
 *
 * Write a row to Postgres FIRST (source of truth), then fire-and-forget
 * an async Notion mirror. Used in Phase B where Postgres is canonical and
 * Notion is the async mirror.
 *
 * Design guarantees:
 *   - The Postgres upsert is the durable write. It must succeed or we throw
 *     so the caller's HTTP handler can return a 5xx rather than a false 200.
 *   - The Notion write is non-blocking. We `.then()` / `.catch()` after
 *     returning so the API response is as fast as a Postgres round-trip
 *     (~10–40ms) rather than a Notion round-trip (~300–800ms).
 *   - On Notion success we back-patch `notion_page_id` onto the Postgres
 *     row (replacing the pre-assigned UUID placeholder).
 *   - On Notion failure we log and enqueue a pcs_pending_writes row for
 *     the retry cron (drift-sync) to pick up. Drift-sync uses
 *     `notion_page_id IS NULL` as the Phase B pending-mirror sentinel.
 *   - A `PCS_WRITE_TO_POSTGRES=1` feature flag gates the Phase B path.
 *     When the flag is off (default today) callers must stay on Phase A.
 *
 * @param {string}   table        — Postgres table name (e.g. 'pcs_evidence')
 * @param {object}   row          — Notion-shape JS object (same as mirrorToPostgres);
 *                                   MUST contain `id` — the pre-assigned UUID
 *                                   this row will use as its Postgres PK until
 *                                   Notion replies with a real page id.
 * @param {object}   columnMap    — *_PG_COLUMN_MAP from the calling lib
 * @param {Function} notionWriteFn — async () => notionPage (the existing Notion create/update)
 * @returns {Promise<{ ok: boolean, id: string, notionQueued: boolean }>}
 */
export async function writePostgresFirst(table, row, columnMap, notionWriteFn) {
  // 1. Canonical Postgres write. enqueueOnFailure=true here because we
  //    cannot fall back to Notion-first in Phase B — the Postgres write
  //    IS the source of truth. If it fails after retries the caller sees
  //    the thrown error and the operation is surfaced as a hard failure.
  const result = await mirrorToPostgres(table, row, columnMap, { enqueueOnFailure: true });
  if (!result.mirrored) {
    throw new Error(`[writePostgresFirst] Postgres write failed for ${table}/${row?.id}: ${result.reason}`);
  }

  // 2. Fire-and-forget Notion mirror. We intentionally do NOT await this
  //    so the API handler can return before Notion responds. Notion is
  //    treated as an eventually-consistent replica in Phase B.
  let notionQueued = false;
  try {
    notionWriteFn()
      .then(async (notionPage) => {
        // Back-patch: replace the pre-assigned UUID placeholder with the
        // real Notion page id so Notion-ID-keyed lookups (relation IDs,
        // /pcs/evidence/[id] routes) keep working. We match on the
        // placeholder id in `notion_page_id` — before this point the
        // Postgres row has `notion_page_id = row.id` (our UUID). After
        // this update it has `notion_page_id = notionPage.id` (the real
        // Notion-format UUID like "abc123de-f012-...").
        if (notionPage?.id && notionPage.id !== row.id) {
          const sb = getPcsSupabase();
          if (sb) {
            const { error: patchErr } = await sb
              .from(table)
              .update({ notion_page_id: notionPage.id })
              .eq('notion_page_id', row.id);
            if (patchErr) {
              console.warn(
                `[writePostgresFirst] notion_page_id back-patch failed for ${table}/${row.id} → ${notionPage.id}: ${patchErr.message}`,
              );
            }
          }
        }
      })
      .catch(async (err) => {
        console.error(
          `[writePostgresFirst] Notion mirror failed for ${table}/${row?.id}: ${err?.message}`,
        );
        // Enqueue for retry by the drift-sync cron. The pending-write
        // payload carries the full row so the retry worker can re-run
        // notionWriteFn semantics. In Phase B the cron uses
        // `notion_page_id IS NULL` OR `pcs_pending_writes` to find
        // rows that still need a Notion sync.
        await enqueuePendingWrite({
          table,
          parsedNotionRow: row,
          columnMap,
          error: err?.message,
        }).catch((qErr) => {
          console.warn(
            `[writePostgresFirst] enqueuePendingWrite also failed for ${table}/${row?.id}: ${qErr?.message}`,
          );
        });
      });
    notionQueued = true;
  } catch (err) {
    // This branch only fires if notionWriteFn() itself throws synchronously
    // (extremely unlikely for an async fn, but be defensive).
    console.warn(`[writePostgresFirst] Notion enqueue failed synchronously:`, err?.message);
  }

  return { ok: true, id: row.id, notionQueued };
}

/**
 * True only when the write-to-Postgres-first feature flag is on AND the
 * Postgres client is configured. Phase B callers gate on this before
 * switching to writePostgresFirst(). When false they stay on Phase A
 * (Notion-first + mirrorToPostgres).
 *
 * Flip via `PCS_WRITE_TO_POSTGRES=1` in Vercel env — no deploy needed.
 */
export function shouldWriteToPostgresFirst() {
  const flag = process.env.PCS_WRITE_TO_POSTGRES;
  if (flag !== '1' && flag !== 'true') return false;
  return getPcsSupabase() !== null;
}

/**
 * Inverse of the parsePostgresRow functions: take a Notion-shape JS
 * object and convert to Postgres row shape.
 *
 * Conventions:
 *   - `id` → `notion_page_id` (the Notion-shape `id` is always the
 *     Notion page UUID; Postgres has its own auto-generated `id` UUID
 *     that we don't touch on upsert)
 *   - `createdTime` → `notion_created_at`
 *   - `lastEditedTime` → `notion_last_edited_at`
 *   - All other camelCase keys → snake_case via simple regex
 *   - Per-call overrides via `columnMap` for non-mechanical mappings
 *     (e.g. {pdf: 'pdf_url'} for pcs_evidence)
 *   - `_*` keys (like `_wasMerged`) and undefined values are stripped
 *   - `synced_at` is set to NOW so we can tell when a row was last touched
 */
function notionShapeToPgRow(parsed, columnMap = {}) {
  const out = {};
  for (const [k, v] of Object.entries(parsed || {})) {
    if (k.startsWith('_')) continue; // strip internal flags
    if (v === undefined) continue;
    if (k === 'id') {
      out.notion_page_id = v;
      continue;
    }
    if (k === 'createdTime') {
      out.notion_created_at = v;
      continue;
    }
    if (k === 'lastEditedTime') {
      out.notion_last_edited_at = v;
      continue;
    }
    const pgKey =
      columnMap[k] ?? k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    out[pgKey] = v;
  }
  // updated_at is auto-set by the trigger on INSERT/UPDATE; not needed here.
  // No synced_at column in 001 schema (yet) — drift cron uses
  // notion_last_edited_at vs Notion's last_edited_time for staleness checks.
  return out;
}
