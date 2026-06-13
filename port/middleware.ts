/**
 * Auth middleware — protect all port routes except login, public pages, and
 * authenticated automation (cron/webhook) requests.
 *
 * Renamed from proxy.ts (G.2.1): Next.js only recognises this file when it is
 * named middleware.ts and exports a function named `middleware`.
 */

import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow auth routes, login page, public pages, and static assets through
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/unsubscribe") ||
    pathname.startsWith("/api/resubscribe") ||
    pathname.startsWith("/api/email/webhooks") ||
    pathname.startsWith("/api/agent/slack") ||
    // MCP endpoint — uses its own bearer auth (PORT_MCP_TOKEN).
    pathname.startsWith("/api/mcp/") ||
    // OAuth server for the agents' MCP connector (Cowork sign-in). /authorize does
    // its own auth() check + login bounce; discovery + token endpoints are public.
    pathname.startsWith("/.well-known/oauth") ||
    pathname.startsWith("/api/oauth/") ||
    // Agent memory APIs (Mo, PaM, cARL, Opsy) — use their own bearer auth (CMO_API_TOKEN).
    pathname.startsWith("/api/cmo/") ||
    pathname.startsWith("/api/pam/") ||
    pathname.startsWith("/api/carl/") ||
    pathname.startsWith("/api/opsy/") ||
    pathname.startsWith("/api/fin/") ||
    // Citation import — route enforces CMO_API_TOKEN for assistant-run backfills.
    // Scoped to /import only; the PDF serve/upload routes stay session-gated.
    pathname.startsWith("/api/bibliography/import") ||
    // Admin backfill tools — routes enforce CMO_API_TOKEN or CRON_SECRET.
    pathname.startsWith("/api/admin/") ||
    // cARL study cron — its route enforces CRON_SECRET or CMO_API_TOKEN, so it can
    // also be triggered on demand by an admin/agent (not just the scheduler).
    pathname === "/api/cron/carl-study" ||
    // Opsy crons — same dual-token pattern as carl-study (health checks,
    // email scan, digest can be triggered on demand by an agent).
    pathname.startsWith("/api/cron/opsy-") ||
    pathname.startsWith("/api/cron/fin-") ||
    // Inngest webhook — Inngest cloud POSTs here to deliver events.
    // Required on Vercel during G.2.4 canary (fallback path for inngest.send()).
    // Remove after G.2.5 DNS cutover + inngest route deletion.
    pathname.startsWith("/api/inngest") ||
    pathname === "/api/revalidate" ||
    pathname === "/api/extract-text" ||
    pathname === "/api/version" ||
    // Pixel tracking — called from external email links, no session context
    pathname.startsWith("/api/tracking/") ||
    pathname === "/login" ||
    pathname.startsWith("/unsubscribe") ||
    pathname.startsWith("/view") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/images/")
  ) {
    return NextResponse.next();
  }

  // Allow cron jobs, webhooks, and admin tools that carry a Bearer token.
  // The individual route handler is responsible for validating CRON_SECRET.
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && process.env.CRON_SECRET) {
    const token = authHeader.slice(7);
    if (token === process.env.CRON_SECRET) {
      return NextResponse.next();
    }
  }

  // Check for session cookie directly — no library dependency in edge runtime
  const sessionCookie =
    req.cookies.get("__Secure-authjs.session-token") ??
    req.cookies.get("authjs.session-token");

  if (!sessionCookie?.value) {
    // API routes get 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pages get redirected to login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
