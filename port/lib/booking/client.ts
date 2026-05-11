/**
 * Supabase client for the wv-booking project (separate from the port's main
 * Supabase). Server-side only — uses service-role key, bypasses RLS.
 *
 * The booking system runs in its own Supabase project; the port reads from it
 * to render the team-side bookings dashboard. Write paths for booking creation
 * stay on windedvertigo.com (site/api/booking/*) — the port only writes to
 * working_hours and availability_overrides directly.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getBookingClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.BOOKING_SUPABASE_URL;
  const key = process.env.BOOKING_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "BOOKING_SUPABASE_URL and BOOKING_SUPABASE_SERVICE_ROLE_KEY must be set on the port worker",
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export const bookingDb = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    return (getBookingClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
