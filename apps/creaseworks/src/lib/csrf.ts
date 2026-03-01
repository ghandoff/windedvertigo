import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF protection via Origin header validation.
 *
 * All modern browsers send the `Origin` header on state-changing requests
 * (POST, PUT, PATCH, DELETE). By checking that it matches our expected
 * host, we prevent cross-site request forgery even if cookies are sent.
 *
 * Multi-zone note: the app is served behind a Vercel multi-zone rewrite
 * (windedvertigo.com → creaseworks-*.vercel.app). After the rewrite,
 * req.nextUrl.host is the internal deployment host, but the browser sends
 * Origin: https://windedvertigo.com. We use x-forwarded-host to get the
 * original host for the comparison.
 *
 * Exempt routes:
 *   - Stripe webhook (/api/stripe/webhook) — verified by signature
 *   - Notion webhook (/api/webhooks/notion) — verified by signature
 *   - Cron sync (/api/cron/sync-notion) — Vercel cron, no cookie
 *   - Matcher (/api/matcher) — public read-only search (POST for body size)
 */

const EXEMPT_PATHS = [
  "/api/stripe/webhook",
  "/api/webhooks/notion",
  "/api/cron/",
  "/api/auth/",
  "/api/matcher",
];

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Get the effective host for CSRF comparison.
 *
 * In a Vercel multi-zone rewrite, req.nextUrl.host is the internal
 * deployment host (creaseworks-*.vercel.app), but the browser sends
 * Origin against the public host (windedvertigo.com). The
 * x-forwarded-host header preserves the original host.
 */
function getEffectiveHost(req: NextRequest): string {
  return req.headers.get("x-forwarded-host") || req.nextUrl.host;
}

/**
 * Returns a 403 response if the request fails the CSRF Origin check.
 * Returns `null` if the request is allowed.
 *
 * Usage in API routes:
 *   const rejected = checkCsrf(req);
 *   if (rejected) return rejected;
 */
export function checkCsrf(req: NextRequest): NextResponse | null {
  // Only check state-changing methods
  if (!STATE_CHANGING_METHODS.has(req.method)) return null;

  // Skip webhook/cron routes that use their own signature verification
  const path = req.nextUrl.pathname;
  if (EXEMPT_PATHS.some((p) => path.startsWith(p))) return null;

  const host = getEffectiveHost(req);
  const origin = req.headers.get("origin");

  // If no Origin header, also check Referer as a fallback.
  // Some older HTTP clients may omit Origin — reject if neither is present.
  if (!origin) {
    const referer = req.headers.get("referer");
    if (!referer) {
      return NextResponse.json(
        { error: "Forbidden — missing Origin header" },
        { status: 403 },
      );
    }
    // Validate Referer host matches
    try {
      const refUrl = new URL(referer);
      if (refUrl.host !== host) {
        return NextResponse.json(
          { error: "Forbidden — cross-origin request" },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Forbidden — invalid Referer" },
        { status: 403 },
      );
    }
    return null;
  }

  // Validate Origin matches our host
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return NextResponse.json(
        { error: "Forbidden — cross-origin request" },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Forbidden — invalid Origin" },
      { status: 403 },
    );
  }

  return null;
}
