/**
 * End-to-end smoke test for Phase 1: OAuth + free/busy.
 *
 * Usage:
 *   cd site
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
 *   GOOGLE_OAUTH_REDIRECT_URI=... BOOKING_TOKEN_KEY=... \
 *   npx tsx scripts/booking-test-freebusy.ts <hostSlug> <fromYYYYMMDD> <toYYYYMMDD>
 *
 * Example:
 *   npx tsx scripts/booking-test-freebusy.ts garrett 2026-05-01 2026-05-08
 *
 * Requires: hostSlug must have completed OAuth at /admin/booking/connect.
 *
 * Prints the host's busy intervals from Google for the given date range.
 * If you see an empty list, the host's calendar is genuinely free for that
 * range. If you see "host has not connected Google" or "invalid_grant",
 * re-OAuth.
 */

export {};

async function main() {
  const [hostSlug, fromStr, toStr] = process.argv.slice(2);
  if (!hostSlug || !fromStr || !toStr) {
    console.error("usage: booking-test-freebusy.ts <hostSlug> <YYYY-MM-DD> <YYYY-MM-DD>");
    process.exit(1);
  }

  const from = new Date(`${fromStr}T00:00:00Z`);
  const to = new Date(`${toStr}T00:00:00Z`);
  if (Number.isNaN(+from) || Number.isNaN(+to)) {
    console.error("invalid dates");
    process.exit(1);
  }

  // We can't easily import the booking lib (it depends on Next runtime
  // shapes); instead we exercise the same code paths via fetch.
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // 1. resolve host_id from slug
  const hostRes = await fetch(`${url}/rest/v1/hosts?slug=eq.${encodeURIComponent(hostSlug)}&select=id,display_name`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const hosts = (await hostRes.json()) as { id: string; display_name: string }[];
  if (hosts.length === 0) {
    console.error(`host not found: ${hostSlug}`);
    process.exit(1);
  }
  const host = hosts[0];

  // 2. fetch the encrypted refresh token
  const tokRes = await fetch(`${url}/rest/v1/oauth_tokens?host_id=eq.${host.id}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const tokens = (await tokRes.json()) as {
    refresh_token_ct: string;
    refresh_token_iv: string;
    google_account_email: string;
  }[];
  if (tokens.length === 0) {
    console.error(`host ${hostSlug} has not connected Google. Visit /admin/booking/connect.`);
    process.exit(1);
  }
  const tok = tokens[0];

  // 3. decrypt the refresh token (Web Crypto)
  const keyB64 = process.env.BOOKING_TOKEN_KEY;
  if (!keyB64) {
    console.error("missing BOOKING_TOKEN_KEY");
    process.exit(1);
  }
  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (keyBytes.length !== 32) {
    console.error("BOOKING_TOKEN_KEY must decode to 32 bytes");
    process.exit(1);
  }
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const ct = Uint8Array.from(atob(tok.refresh_token_ct), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(tok.refresh_token_iv), (c) => c.charCodeAt(0));
  const ptBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ct);
  const refreshToken = new TextDecoder().decode(ptBuf);

  // 4. exchange refresh token for access token
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET");
    process.exit(1);
  }
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!refreshRes.ok) {
    console.error("refresh token exchange failed:", await refreshRes.text());
    process.exit(1);
  }
  const { access_token } = (await refreshRes.json()) as { access_token: string };

  // 5. call freeBusy
  const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: [{ id: "primary" }],
    }),
  });
  if (!fbRes.ok) {
    console.error("freeBusy failed:", await fbRes.text());
    process.exit(1);
  }
  const fb = (await fbRes.json()) as {
    calendars: Record<string, { busy?: { start: string; end: string }[] }>;
  };
  const busy = fb.calendars?.primary?.busy ?? [];

  console.log(`✓ ${host.display_name} (${tok.google_account_email})`);
  console.log(`  range: ${from.toISOString()} → ${to.toISOString()}`);
  console.log(`  ${busy.length} busy intervals:`);
  for (const b of busy) {
    const dur = Math.round((+new Date(b.end) - +new Date(b.start)) / 60000);
    console.log(`    ${b.start} → ${b.end}  (${dur}m)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
