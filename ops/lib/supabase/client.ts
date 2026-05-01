import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazily-initialized client. Throwing at module evaluation time would crash
// `next build` during "collecting page data" if env vars are absent (e.g. in
// preview environments). Deferring to first use means only request handlers
// that actually call getSupabase() fail at runtime, not the whole build.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  }

  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  return _client;
}
