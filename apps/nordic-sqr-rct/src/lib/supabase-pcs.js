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
export async function mirrorToPostgres(table, parsedNotionRow, columnMap = {}) {
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
    return { mirrored: false, reason: err.message };
  }
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
