import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF protection via Origin header validation.
 *
 * All modern browsers send the `Origin` header on state-changing requests
 * (POST, PUT, PATCH, DELETE). By checking that it matches our expected
 * host, we prevent cross-site request forgery even if cookies are sent.
 *
 * Exempt routes:
 *   - Stripe webhook (/api/stripe/webhook) — verified by signature
 *   - Notion webhook (/api/webhooks/notion) — verified by signature
 *   - Cron sync (/api/cron/sync-notion) — Vercel cron, no cookie
 */

const EXEMPT_PATHS = [
  "/api/stripe/webhook",
  "/api/webhooks/notion",
  "/api/cron/sync-notion",
];

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
      const host = req.nextUrl.host;
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
    const host = req.nextUrl.host;
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
