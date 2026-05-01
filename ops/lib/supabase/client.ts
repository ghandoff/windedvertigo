import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client, or null if env vars are absent (e.g. preview
 * deploys without secrets configured). Callers must null-check the result.
 *
 * Using the null-returning pattern (rather than throwing) means:
 * 1. Module evaluation never throws → Next.js collectPageData succeeds.
 * 2. Individual routes can choose whether to gracefully degrade or error out.
 */
let _client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  _client ??= createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
