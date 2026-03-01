import { Auth } from "@auth/core";
import { authConfig } from "@/lib/auth";
import { NextRequest } from "next/server";

/**
 * Custom Auth.js route handler that bypasses next-auth's `reqWithEnvURL`.
 *
 * ## Why this is needed
 *
 * When `basePath: "/reservoir/creaseworks"` is set in next.config.ts, Next.js
 * strips that prefix before the route handler sees the request. Auth.js needs
 * the full external path (including the prefix) to match its action regex
 * `^/reservoir/creaseworks/api/auth(.+)`.
 *
 * The obvious fix — wrapping handlers.GET/POST to re-add the prefix via
 * `new NextRequest(urlWithPrefix, req)` — does NOT work because:
 *
 *   1. NextRequest's internal `NextURL` detects the basePath from Next.js config
 *      and silently strips it from the internal URL representation.
 *   2. next-auth's `reqWithEnvURL` reads `req.nextUrl.href` (the stripped path),
 *      NOT `req.url`.
 *   3. So Auth.js never sees the prefix → "Bad request." (UnknownAction).
 *
 * ## The fix
 *
 * Call `@auth/core`'s `Auth()` directly with a plain `Request` (not
 * `NextRequest`). Plain `Request` objects don't have NextURL or basePath
 * stripping, so the URL we construct is passed to Auth.js verbatim.
 */
async function handler(req: NextRequest) {
  // Build the full URL Auth.js expects (with basePath prefix)
  const url = new URL(req.url);
  url.pathname = `/reservoir/creaseworks${url.pathname}`;

  // Replace origin with AUTH_URL if set (replicating what reqWithEnvURL does)
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
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

  // authConfig is typed as NextAuthConfig (from next-auth) but Auth() expects
  // AuthConfig (from @auth/core). They are structurally identical but TS sees
  // them as different types because next-auth bundles its own @auth/core copy.
  // The cast is safe — NextAuth() already validates the config at module init.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Auth(request, authConfig as any) as Promise<Response>;
}

export { handler as GET, handler as POST };
