/**
 * GET /api/gusto/callback
 *
 * OAuth 2.0 callback from Gusto. Exchanges the authorization code for an
 * access_token + refresh_token, then renders a simple HTML page showing the
 * refresh_token so the admin can store it as GUSTO_REFRESH_TOKEN in Vercel.
 *
 * This route is called once during initial setup. After the refresh_token is
 * stored, the sync runs automatically without user interaction.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const GUSTO_API_BASE = process.env.GUSTO_API_BASE ?? "https://api.gusto.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://port.windedvertigo.com";

export async function GET(req: NextRequest) {
  console.log("[gusto/callback] OAuth callback received");

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    console.error(`[gusto/callback] OAuth error: ${error}`);
    return NextResponse.json({ error: `Gusto OAuth error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const clientId = process.env.GUSTO_CLIENT_ID;
  const clientSecret = process.env.GUSTO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GUSTO_CLIENT_ID or GUSTO_CLIENT_SECRET not configured" },
      { status: 500 },
    );
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch(`${GUSTO_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${APP_URL}/api/gusto/callback`,
      code,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    console.error(`[gusto/callback] Token exchange failed (${tokenRes.status}): ${body}`);
    return NextResponse.json(
      { error: `Token exchange failed (${tokenRes.status})` },
      { status: 500 },
    );
  }

  const tokens = await tokenRes.json();
  const refreshToken: string = tokens.refresh_token ?? "";
  const scopes: string = tokens.scope ?? "";

  console.log(`[gusto/callback] Tokens obtained for ${session.user.email} scope="${scopes}"`);

  // Show the refresh token to the admin so they can store it in Vercel.
  // This page is only reachable by authenticated users who went through the
  // OAuth flow — the refresh token is not logged or stored server-side here.
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Gusto connected — w.v port</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f9fafb; color: #111; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;
            max-width: 560px; width: 100%; }
    h1 { font-size: 1.125rem; font-weight: 600; margin-bottom: 8px; }
    p  { font-size: 0.875rem; color: #6b7280; line-height: 1.6; margin-bottom: 16px; }
    code { display: block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px;
           padding: 12px 14px; font-family: monospace; font-size: 0.8rem; word-break: break-all;
           margin-bottom: 20px; }
    .cmd { background: #1e2738; color: #ffebd2; }
    .badge { display: inline-block; background: #dcfce7; color: #15803d; border-radius: 4px;
             padding: 2px 8px; font-size: 0.75rem; font-weight: 500; margin-bottom: 20px; }
    .warn { color: #b45309; font-size: 0.8125rem; background: #fef3c7; border: 1px solid #fde68a;
            border-radius: 6px; padding: 10px 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✓ Gusto connected</div>
    <h1>Gusto OAuth complete</h1>
    <p>Scopes granted: <strong>${scopes}</strong></p>
    <p>Copy the refresh token below, then run the two Vercel CLI commands in your terminal to wire up the sync.</p>

    <p style="font-weight:600;font-size:0.8125rem;margin-bottom:6px;">Refresh token (keep this secret):</p>
    <code>${refreshToken}</code>

    <p style="font-weight:600;font-size:0.8125rem;margin-bottom:6px;">Run in terminal (wv-crm project):</p>
    <code class="cmd">vercel env add GUSTO_REFRESH_TOKEN --scope wv-crm
vercel env add GUSTO_COMPANY_UUID --scope wv-crm</code>

    <p>For <code>GUSTO_COMPANY_UUID</code> enter: <strong>1be7612b-b886-475e-b76f-a28af4624a16</strong></p>
    <p>Then redeploy: <code style="display:inline;background:#f3f4f6;padding:2px 6px;border-radius:4px;">vercel --prod -y</code></p>

    <div class="warn">⚠ Close this tab after copying — the token is not stored anywhere on this page.</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
