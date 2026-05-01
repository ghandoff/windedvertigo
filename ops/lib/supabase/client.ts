import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy Supabase client — initialized on first access so that the module can
 * be imported without throwing at build time when env vars are absent.
 * The wv-ops Vercel project requires NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY to be set; if they're missing the error surfaces at
 * runtime (request time) rather than during Next.js collectPageData.
 */
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
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
