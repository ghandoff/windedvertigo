import { NextRequest, NextResponse } from "next/server";

/**
 * CSP proxy (Next.js 16 replaces middleware.ts with proxy.ts) —
 * generates a per-request nonce and sets the Content-Security-Policy
 * header. Next.js reads the nonce from the `x-nonce` request header
 * and automatically applies it to inline hydration scripts.
 *
 * Using `'strict-dynamic'` (CSP Level 3):
 *   - Nonced scripts can dynamically load other scripts (covers Next.js chunks)
 *   - Source expressions like `'self'` and URL allowlists serve as CSP Level 2 fallbacks
 *   - `'unsafe-inline'` is no longer needed in script-src
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://vitals.vercel-insights.com https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|images/|favicon\\.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
