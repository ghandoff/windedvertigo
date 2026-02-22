import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js middleware — runs on every matched request before the route handler.
 *
 * Currently handles:
 *   1. CSRF protection via Origin header validation on state-changing methods
 */

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Webhook/cron routes that use their own signature-based auth */
const CSRF_EXEMPT_PATHS = [
  "/api/stripe/webhook",
  "/api/webhooks/notion",
  "/api/cron/sync-notion",
];

export function middleware(req: NextRequest) {
  // ── CSRF check ──────────────────────────────────────────────
  if (STATE_CHANGING_METHODS.has(req.method)) {
    const path = req.nextUrl.pathname;

    // Skip webhook/cron routes — they verify via cryptographic signatures
    if (!CSRF_EXEMPT_PATHS.some((p) => path.startsWith(p))) {
      const origin = req.headers.get("origin");
      const host = req.nextUrl.host;

      if (origin) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
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
      } else {
        // No Origin header — check Referer as fallback
        const referer = req.headers.get("referer");
        if (referer) {
          try {
            const refHost = new URL(referer).host;
            if (refHost !== host) {
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
        } else {
          // Neither Origin nor Referer — reject
          return NextResponse.json(
            { error: "Forbidden — missing Origin header" },
            { status: 403 },
          );
        }
      }
    }
  }

  return NextResponse.next();
}

/** Only run on API routes — pages don't need CSRF checks */
export const config = {
  matcher: "/api/:path*",
};
