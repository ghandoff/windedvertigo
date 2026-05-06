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
