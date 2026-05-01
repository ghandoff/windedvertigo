import { Auth } from "@auth/core";
import type { NextAuthConfig } from "next-auth";
import { NextRequest } from "next/server";

/**
 * Create a custom Auth.js route handler for a harbour app.
 *
 * Bypasses next-auth's `reqWithEnvURL` by calling `@auth/core`'s `Auth()`
 * directly with a plain `Request` (not `NextRequest`). This avoids NextURL
 * basePath stripping that breaks Auth.js's action regex when apps use
 * Next.js basePath (e.g. `/harbour/creaseworks`).
 *
 * The basePath prepend is idempotent: Next.js usually strips the basePath
 * from `req.url` in route handlers, but Vercel rewrites can deliver the
 * full path. We normalise to always include the prefix exactly once.
 *
 * Usage:
 * ```ts
 * // apps/creaseworks/src/app/api/auth/[...nextauth]/route.ts
 * import { createAuthRouteHandler } from "@windedvertigo/auth/route-handler";
 * import { authConfig } from "@/lib/auth";
 *
 * const { GET, POST } = createAuthRouteHandler("creaseworks", authConfig);
 * export { GET, POST };
 * ```
 */
export function createAuthRouteHandler(
  appName: string,
  authConfig: NextAuthConfig,
) {
  // Empty appName = harbour hub itself, mounted at /harbour (no sub-path).
  // Each non-empty appName produces /harbour/<sub>. Matches the basePath
  // logic in `config.ts`.
  const basePath = appName ? `/harbour/${appName}` : `/harbour`;

  async function handler(req: NextRequest) {
    const url = new URL(req.url);

    // Ensure basePath appears exactly once in the pathname
    if (!url.pathname.startsWith(basePath)) {
      url.pathname = `${basePath}${url.pathname}`;
    }

    // Replace origin with AUTH_URL if set (replicating what reqWithEnvURL does).
    // Falls back through AUTH_URL → NEXTAUTH_URL → NEXT_PUBLIC_APP_URL.
    const authUrl =
      process.env.AUTH_URL ??
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL;
    if (authUrl) {
      const envOrigin = new URL(authUrl);
      url.protocol = envOrigin.protocol;
      url.host = envOrigin.host;
    }

    // Use plain Request (NOT NextRequest) to avoid NextURL basePath stripping
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      // @ts-expect-error duplex is required for streaming request bodies but
      // not yet in the TS Request type definition
      duplex: "half",
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await Auth(request, authConfig as any)) as Response;
    } catch (err) {
      // Surface the real error to worker logs — Auth.js swallows most
      // callback errors and redirects to ?error=Configuration without
      // exposing the cause.
      console.error("[harbour-auth][uncaught]", err);
      throw err;
    }
  }

  return { GET: handler, POST: handler };
}
