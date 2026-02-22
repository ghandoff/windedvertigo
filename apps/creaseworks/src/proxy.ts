/**
 * Next.js 16 proxy for route protection and API rate limiting.
 *
 * Migrated from middleware.ts -> proxy.ts per Next.js 16 convention.
 * Proxy runs on the Node.js runtime (not Edge), so the original
 * constraint of avoiding heavy imports for Edge compatibility no
 * longer applies. We still use getToken from next-auth/jwt for
 * lightweight JWT verification.
 *
 * Public routes: /, /sampler/*, /matcher/*, /packs (catalogue only), /login, /api/auth/*, /api/cron/*, /api/matcher/*
 * Protected routes: /packs/[slug]/*, /runs/*, /admin/*, /api/admin/*
 *
 * Rate limiting: Postgres-backed sliding window counter on /api/* routes.
 *   - Authenticated: 60 requests/min
 *   - Anonymous: 20 requests/min
 *   - Falls back to in-memory bucket if DB is unavailable.
 *
 * CSRF protection: Origin header validation on state-changing methods.
 *   - Rejects POST/PUT/PATCH/DELETE from cross-origin requests.
 *   - Falls back to Referer header if Origin is missing.
 *   - Exempt: Stripe webhook, Notion webhook, cron routes (signature-verified).
 *
 * Unauthenticated users hitting protected routes are redirected to /login.
 *
 * MVP 4 -- admin pages and rate limiting.
 * Updated session 11: middleware.ts -> proxy.ts (Next.js 16).
 * Updated session 12: persistent Postgres-backed rate limiter.
 * Updated session 14: CSRF Origin header validation.
 */

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkCsrf } from "@/lib/csrf";

/* ------------------------------------------------------------------ */
/*  rate limiting config                                               */
/* ------------------------------------------------------------------ */

const AUTHED_LIMIT = 60; // requests per 1-minute window
const ANON_LIMIT = 20;

function getRateLimitKey(req: NextRequest, isAuthed: boolean): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${isAuthed ? "authed" : "anon"}`;
}

/* ------------------------------------------------------------------ */
/*  route protection                                                   */
/* ------------------------------------------------------------------ */

// Routes that don't require authentication
const publicPatterns = [
  /^\/$/,
  /^\/sampler(\/.*)?$/,
  /^\/matcher(\/.*)?$/,     // matcher is public (entitled fields gated server-side)
  /^\/packs\/?$/,           // packs catalogue is public; /packs/[slug]/* requires auth
  /^\/login$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/cron(\/.*)?$/,
  /^\/api\/matcher(\/.*)?$/,
  /^\/api\/stripe\/webhook$/,  // Stripe calls this directly (verified by signature)
  /^\/api\/webhooks\/notion$/,  // Notion calls this directly (verified by signature)
  /^\/api\/team\/domains\/verify$/,  // email verification callback (token-based, no session needed)
  /^\/checkout\/success$/,     // Stripe redirects here after payment
  /^\/_next(\/.*)?$/,
  /^\/favicon\.ico$/,
];

function isPublicRoute(pathname: string): boolean {
  return publicPatterns.some((pattern) => pattern.test(pathname));
}

/* ------------------------------------------------------------------ */
/*  proxy                                                              */
/* ------------------------------------------------------------------ */

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF protection — reject cross-origin state-changing requests
  const csrfRejection = checkCsrf(req);
  if (csrfRejection) return csrfRejection;

  // Skip rate limiting for static assets, auth, and webhook routes
  const isApiRoute = pathname.startsWith("/api/");
  const isCronRoute = pathname.startsWith("/api/cron/");
  const isAuthRoute = pathname.startsWith("/api/auth/");
  const isWebhookRoute = pathname.startsWith("/api/stripe/webhook") || pathname.startsWith("/api/webhooks/notion");

  // Check authentication via JWT
  // On HTTPS (production), NextAuth v5 prefixes cookies with __Secure-.
  // We must tell getToken() so it looks for the right cookie name.
  const useSecureCookies = req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: useSecureCookies,
  });
  const isAuthed = !!token;

  // Rate limit API routes (except cron, auth, and webhooks)
  if (isApiRoute && !isCronRoute && !isAuthRoute && !isWebhookRoute) {
    const limit = isAuthed ? AUTHED_LIMIT : ANON_LIMIT;
    const key = getRateLimitKey(req, isAuthed);

    const allowed = await checkRateLimit(key, limit);
    if (!allowed) {
      return NextResponse.json(
        { error: "too many requests -- try again in a moment" },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
      );
    }
  }

  // Allow public routes through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users on protected routes
  if (!isAuthed) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
