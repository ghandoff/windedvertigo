/**
 * GET /api/booking/oauth/google/callback?code=...&state=...
 *
 * OAuth 2.0 callback. Verifies the HMAC-signed state (binds the callback
 * to the original host), exchanges the code for tokens, encrypts the
 * refresh token, and persists. Redirects back to the admin connect page
 * with a status query param.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchUserInfo, persistToken } from "@/lib/booking/google-oauth";
import { verify, type OauthStateTokenPayload } from "@/lib/booking/sign";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Google sends ?error=access_denied if the user clicks Cancel
  if (errorParam) {
    console.warn("[booking.oauth.callback] user denied or error", { errorParam });
    return NextResponse.redirect(
      new URL(`/admin/booking/connect?status=denied`, req.url),
    );
  }

  if (!code || !state) {
    return NextResponse.json({ error: "missing code or state" }, { status: 400 });
  }

  // Verify state — this binds the callback to the original host and
  // prevents CSRF / replay across different host onboardings.
  let statePayload: OauthStateTokenPayload;
  try {
    statePayload = await verify<OauthStateTokenPayload>(state);
  } catch (e) {
    console.error("[booking.oauth.callback] state verify failed", { err: String(e) });
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      // This should never happen because we set prompt=consent + access_type=offline,
      // but Google occasionally omits it on already-granted accounts. The fix is for
      // the user to revoke the grant in their Google account settings and try again.
      console.error("[booking.oauth.callback] no refresh_token in response", {
        hostId: statePayload.hostId,
      });
      return NextResponse.redirect(
        new URL(`/admin/booking/connect?status=no_refresh_token&host=${statePayload.hostId}`, req.url),
      );
    }

    let googleEmail = "unknown@google";
    try {
      const info = await fetchUserInfo(tokens.access_token);
      googleEmail = info.email || googleEmail;
    } catch (e) {
      // Non-fatal — we just won't have the google_account_email populated nicely
      console.warn("[booking.oauth.callback] userinfo fetch failed", { err: String(e) });
    }

    await persistToken({
      hostId: statePayload.hostId,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      accessExpiresIn: tokens.expires_in,
      scope: tokens.scope,
      googleAccountEmail: googleEmail,
    });

    console.log("[booking.oauth.callback] connected", {
      hostId: statePayload.hostId,
      googleEmail,
    });

    return NextResponse.redirect(
      new URL(`/admin/booking/connect?status=connected&host=${statePayload.hostId}`, req.url),
    );
  } catch (e) {
    console.error("[booking.oauth.callback] exchange/persist failed", { err: String(e) });
    return NextResponse.redirect(
      new URL(`/admin/booking/connect?status=error&host=${statePayload.hostId}`, req.url),
    );
  }
}
