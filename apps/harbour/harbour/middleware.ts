/**
 * Harbour middleware.
 *
 * Pool A pattern (mirrors apps/depth-chart/middleware.ts): export the
 * `auth` callable from the shared auth.ts as the middleware. It runs
 * Auth.js's session check and attaches the session to the request.
 *
 * `matcher` deliberately keeps `/harbour` itself OPEN — public users
 * must be able to land on the hub without auth. Only `/account/*` is
 * gated for now. Login is included so Auth.js can show a friendlier
 * "already signed in" experience when an authenticated user revisits.
 */

export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/account/:path*", "/login"],
};
