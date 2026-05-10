/**
 * GET /api/auth/callback/linkedin
 *
 * OAuth callback to exchange authorization code for access + refresh tokens.
 * After getting the tokens, displays them for storage as env vars.
 * Includes offline_access scope for refresh token support.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error, description: req.nextUrl.searchParams.get("error_description") }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "no authorization code" }, { status: 400 });
  }

  // Exchange code for access token + refresh token
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://port.windedvertigo.com/api/auth/callback/linkedin",
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json({ error: "token exchange failed", details: err }, { status: 500 });
  }

  const tokenData = await tokenRes.json();

  // Get the user's profile to find their person URN
  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const profile = profileRes.ok ? await profileRes.json() : null;

  const personUrn = profile?.sub ? `urn:li:person:${profile.sub}` : null;

  // Build wrangler secret put commands for easy copy-paste
  const commands = [
    `echo "${tokenData.access_token}" | npx wrangler secret put LINKEDIN_ACCESS_TOKEN --name wv-port`,
    tokenData.refresh_token
      ? `echo "${tokenData.refresh_token}" | npx wrangler secret put LINKEDIN_REFRESH_TOKEN --name wv-port`
      : null,
    personUrn
      ? `echo "${personUrn}" | npx wrangler secret put LINKEDIN_PERSON_URN --name wv-port`
      : null,
  ].filter(Boolean);

  return NextResponse.json({
    message: "linkedin OAuth successful — run these wrangler commands to persist the secrets:",
    wrangler_commands: commands,
    tokens: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_in_days: Math.round(tokenData.expires_in / 86400),
      refresh_token_expires_in_days: tokenData.refresh_token_expires_in
        ? Math.round(tokenData.refresh_token_expires_in / 86400)
        : null,
    },
    profile: {
      person_urn: personUrn,
      name: profile?.name,
      email: profile?.email,
    },
  });
}
