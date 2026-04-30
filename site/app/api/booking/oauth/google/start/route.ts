/**
 * GET /api/booking/oauth/google/start?host=<slug>&admin=<token>
 *
 * Admin-gated. Redirects to Google's OAuth consent screen with a state
 * param HMAC-bound to the host. Used during one-time onboarding by each
 * collective member at /admin/booking/connect.
 */

import { NextRequest, NextResponse } from "next/server";
import { selectOne } from "@/lib/booking/supabase";
import type { Host } from "@/lib/booking/supabase";
import { buildAuthUrl } from "@/lib/booking/google-oauth";
import { mint, nowSec, type OauthStateTokenPayload } from "@/lib/booking/sign";

function checkAdmin(token: string | null): boolean {
  const expected = process.env.BOOKING_ADMIN_TOKEN;
  if (!expected || !token) return false;
  // Constant-time compare to avoid timing attacks
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const adminToken = url.searchParams.get("admin");
  const hostSlug = url.searchParams.get("host");

  if (!checkAdmin(adminToken)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hostSlug) {
    return NextResponse.json({ error: "host slug required" }, { status: 400 });
  }

  let host: Host | null;
  try {
    host = await selectOne<Host>("hosts", { slug: `eq.${hostSlug}` });
  } catch (e) {
    console.error("[booking.oauth.start] supabase lookup failed", { hostSlug, err: String(e) });
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!host) {
    console.warn("[booking.oauth.start] host not found", { hostSlug });
    return NextResponse.json({ error: "host not found" }, { status: 404 });
  }

  // 10-minute state TTL — plenty for the consent flow
  const nonce = crypto.randomUUID();
  const state = await mint<OauthStateTokenPayload>({
    hostId: host.id,
    nonce,
    exp: nowSec() + 600,
  });

  console.log("[booking.oauth.start] consent redirect", { hostSlug, hostId: host.id });
  return NextResponse.redirect(buildAuthUrl(state));
}
