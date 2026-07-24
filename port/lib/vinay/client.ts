/**
 * Supabase client for the wv-vinay project — garrett's personal-assistant
 * (vinay) data store, deliberately separate from the port's main Supabase so
 * personal context never shares a database — or a backup / dump — with company
 * data. Same pattern as lib/booking/client.ts (a second project the port worker
 * already talks to).
 *
 * Server-side only — uses the service-role key, bypasses RLS. Never import in
 * browser code. Acquired lazily behind a Proxy: on Workers, secrets are bound
 * per-request, not at isolate init, so a module-scope `new` would capture an
 * empty env (the #415 footgun).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getVinayClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.VINAY_SUPABASE_URL;
  const key = process.env.VINAY_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "VINAY_SUPABASE_URL and VINAY_SUPABASE_SERVICE_ROLE_KEY must be set on the port worker",
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export const vinayDb = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    return (getVinayClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
