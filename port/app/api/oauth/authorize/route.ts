/**
 * OAuth 2.1 authorization endpoint (authorization-code + PKCE).
 *
 * GET  — validate the client + PKCE, require a winded.vertigo session (reusing
 *        the existing Auth.js Google login), then show a one-click consent page.
 * POST — on approval, mint a one-time code (KV, 120s) and redirect back to the
 *        client's redirect_uri with ?code&state.
 *
 * The human login is NOT reimplemented here — if there's no session we bounce to
 * /login (Google) with callbackUrl back to this URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAllowedEmail } from "@/lib/oauth/config";
import { getClient, putCode } from "@/lib/oauth/store";

function redirectWithError(redirectUri: string, state: string | null, error: string, desc?: string) {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (desc) u.searchParams.set("error_description", desc);
  if (state) u.searchParams.set("state", state);
  return NextResponse.redirect(u.toString(), { status: 303 });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function consentPage(email: string, clientName: string, params: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>authorise — winded.vertigo</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background:#f4efe6; color:#1f2a30; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .card { background:#fff; border-radius:16px; padding:32px; max-width:380px; width:90%; box-shadow:0 6px 28px rgba(0,0,0,.08); text-align:center; }
  h1 { font-size:18px; margin:0 0 4px; }
  p { font-size:14px; line-height:1.5; color:#46555c; margin:8px 0; }
  .who { font-weight:600; }
  .agents { font-size:13px; color:#46555c; background:#f4efe6; border-radius:10px; padding:10px 12px; margin:16px 0; }
  button { width:100%; border:0; border-radius:10px; padding:12px; font-size:14px; font-weight:600; cursor:pointer; }
  .approve { background:#1f2a30; color:#f4efe6; margin-top:12px; }
  .deny { background:transparent; color:#46555c; margin-top:8px; }
  .deny:hover { text-decoration:underline; }
</style></head>
<body><div class="card">
  <h1>connect to your winded.vertigo agents</h1>
  <p><span class="who">${esc(clientName || "Claude")}</span> wants to reach Mo, PaM, and cARL on your behalf.</p>
  <p>signed in as <span class="who">${esc(email)}</span></p>
  <div class="agents">it will be able to read and update the agents' shared memory (decisions, commitments, research findings).</div>
  <form method="post" action="/api/oauth/authorize">
    <input type="hidden" name="params" value="${esc(params)}">
    <button class="approve" name="approve" value="yes" type="submit">approve</button>
    <button class="deny" name="approve" value="no" type="submit">cancel</button>
  </form>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const client_id = p.get("client_id") ?? "";
  const redirect_uri = p.get("redirect_uri") ?? "";
  const response_type = p.get("response_type") ?? "";
  const code_challenge = p.get("code_challenge") ?? "";
  const code_challenge_method = p.get("code_challenge_method") ?? "";
  const state = p.get("state");

  const client = await getClient(client_id);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }
  if (!redirect_uri || !client.redirect_uris.includes(redirect_uri)) {
    return NextResponse.json({ error: "invalid_request", error_description: "redirect_uri mismatch" }, { status: 400 });
  }
  if (response_type !== "code") return redirectWithError(redirect_uri, state, "unsupported_response_type");
  if (!code_challenge || code_challenge_method !== "S256") {
    return redirectWithError(redirect_uri, state, "invalid_request", "PKCE S256 required");
  }

  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
    // No session — send through the existing Google login, then back here.
    const callbackUrl = `${req.nextUrl.pathname}?${p.toString()}`;
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(login.toString(), { status: 303 });
  }
  if (!isAllowedEmail(email)) {
    return redirectWithError(redirect_uri, state, "access_denied", "account not permitted");
  }

  return new NextResponse(consentPage(email, client.client_name ?? "Claude", p.toString()), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const approve = String(form.get("approve") ?? "");
  const p = new URLSearchParams(String(form.get("params") ?? ""));
  const client_id = p.get("client_id") ?? "";
  const redirect_uri = p.get("redirect_uri") ?? "";
  const state = p.get("state");
  const code_challenge = p.get("code_challenge") ?? "";
  const scope = p.get("scope") ?? "mcp";
  const resource = p.get("resource") ?? "";

  const client = await getClient(client_id);
  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAllowedEmail(email)) {
    return redirectWithError(redirect_uri, state, "access_denied", "account not permitted");
  }
  if (approve !== "yes") {
    return redirectWithError(redirect_uri, state, "access_denied", "user denied");
  }

  const code = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  await putCode(code, { client_id, redirect_uri, code_challenge, email, resource, scope });

  const u = new URL(redirect_uri);
  u.searchParams.set("code", code);
  if (state) u.searchParams.set("state", state);
  return NextResponse.redirect(u.toString(), { status: 303 });
}
