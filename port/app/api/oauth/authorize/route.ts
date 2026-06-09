/**
 * OAuth 2.1 authorization endpoint (authorization-code + PKCE).
 *
 * Flow (all GET, no form submission):
 *  - no `decision`  → validate client + PKCE, require a winded.vertigo session
 *    (reusing the existing Auth.js Google login), then render a one-click consent
 *    page whose Approve/Cancel are plain links back to this URL with `decision=…`.
 *  - decision=approve → mint a one-time code (KV, 120s) and 302 to the client's
 *    redirect_uri with ?code&state.
 *  - decision=deny    → redirect back with error=access_denied.
 *
 * Why links, not a form: the app's global CSP sets `form-action 'self'`, which
 * blocks a form POST from redirecting to the client's external callback
 * (https://claude.ai/api/mcp/auth_callback). A top-level link navigation isn't a
 * form submission, so the cross-origin redirect is allowed.
 *
 * The human login is delegated to /login (Google) — not reimplemented here.
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
  return NextResponse.redirect(u.toString(), { status: 302 });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function consentPage(email: string, clientName: string, approveHref: string, denyHref: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>authorise — winded.vertigo</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background:#f4efe6; color:#1f2a30; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .card { background:#fff; border-radius:16px; padding:32px; max-width:380px; width:90%; box-shadow:0 6px 28px rgba(0,0,0,.08); text-align:center; }
  h1 { font-size:18px; margin:0 0 4px; }
  p { font-size:14px; line-height:1.5; color:#46555c; margin:8px 0; }
  .who { font-weight:600; color:#1f2a30; }
  .agents { font-size:13px; color:#46555c; background:#f4efe6; border-radius:10px; padding:10px 12px; margin:16px 0; }
  a.btn { display:block; text-decoration:none; border-radius:10px; padding:12px; font-size:14px; font-weight:600; }
  a.approve { background:#1f2a30; color:#f4efe6; margin-top:12px; }
  a.deny { color:#46555c; margin-top:8px; }
  a.deny:hover { text-decoration:underline; }
</style></head>
<body><div class="card">
  <h1>connect to your winded.vertigo agents</h1>
  <p><span class="who">${esc(clientName || "Claude")}</span> wants to reach Mo, PaM, and cARL on your behalf.</p>
  <p>signed in as <span class="who">${esc(email)}</span></p>
  <div class="agents">it will be able to read and update the agents' shared memory (decisions, commitments, research findings).</div>
  <a class="btn approve" href="${esc(approveHref)}">approve</a>
  <a class="btn deny" href="${esc(denyHref)}">cancel</a>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const decision = p.get("decision");
  const client_id = p.get("client_id") ?? "";
  const redirect_uri = p.get("redirect_uri") ?? "";
  const response_type = p.get("response_type") ?? "";
  const code_challenge = p.get("code_challenge") ?? "";
  const code_challenge_method = p.get("code_challenge_method") ?? "";
  const state = p.get("state");
  const scope = p.get("scope") ?? "mcp";
  const resource = p.get("resource") ?? "";

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

  // Require a winded.vertigo session (delegated to the existing Google login).
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
    const clean = new URLSearchParams(p);
    clean.delete("decision");
    const callbackUrl = `${req.nextUrl.pathname}?${clean.toString()}`;
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(login.toString(), { status: 302 });
  }
  if (!isAllowedEmail(email)) {
    return redirectWithError(redirect_uri, state, "access_denied", "account not permitted");
  }

  if (decision === "deny") {
    return redirectWithError(redirect_uri, state, "access_denied", "user denied");
  }

  if (decision === "approve") {
    const code = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    await putCode(code, { client_id, redirect_uri, code_challenge, email, resource, scope });
    const u = new URL(redirect_uri);
    u.searchParams.set("code", code);
    if (state) u.searchParams.set("state", state);
    return NextResponse.redirect(u.toString(), { status: 302 });
  }

  // No decision yet → show consent. Approve/Cancel are plain links (not a form),
  // so the eventual cross-origin redirect to the client's callback isn't blocked
  // by the global `form-action 'self'` CSP.
  const base = `${req.nextUrl.pathname}?${p.toString()}`;
  const approveHref = `${base}&decision=approve`;
  const denyHref = `${base}&decision=deny`;
  return new NextResponse(consentPage(email, client.client_name ?? "Claude", approveHref, denyHref), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
