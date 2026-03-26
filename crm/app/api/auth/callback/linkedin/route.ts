/**
 * GET /api/auth/callback/linkedin
 *
 * One-time OAuth callback to exchange authorization code for access token.
 * After getting the token, displays it for manual storage as an env var.
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

  // Exchange code for access token
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://crm.windedvertigo.com/api/auth/callback/linkedin",
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

  return NextResponse.json({
    message: "LinkedIn OAuth successful. Copy these values to Vercel env vars.",
    access_token: tokenData.access_token,
    expires_in_seconds: tokenData.expires_in,
    expires_in_days: Math.round(tokenData.expires_in / 86400),
    person_sub: profile?.sub,
    person_urn: profile?.sub ? `urn:li:person:${profile.sub}` : "unknown",
    name: profile?.name,
    email: profile?.email,
  });
}
