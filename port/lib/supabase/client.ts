/**
 * Supabase client — server-side only (uses service-role key that bypasses RLS).
 * Never import this in browser code or NEXT_PUBLIC_ modules.
 *
 * Uses lazy initialization via a Proxy so that the module can be imported
 * without throwing at build time when env vars are absent in preview deploys.
 * The error surfaces at request time when a Supabase method is first called.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set",
    );
  }
  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  return _client;
}

/**
 * Proxy so existing `supabase.from(...)` callsites continue to work without
 * any changes — the real client is only resolved on the first property access.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[
      prop
    ];
  },
});
