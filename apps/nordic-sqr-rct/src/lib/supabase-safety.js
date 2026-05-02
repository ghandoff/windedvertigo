/**
 * Minimal Supabase client for the safety saga tables (safety_sweep_pending).
 * Uses a separate env var so it can be scoped to the wv-nordic Supabase project.
 * Returns null if not configured (preview / local dev without Supabase).
 */

import { createClient } from '@supabase/supabase-js';

let _client = null;

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSafetySupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_NORDIC_URL;
  const key = process.env.SUPABASE_NORDIC_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}
