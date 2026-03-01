import { Auth } from "@auth/core";
import { authConfig } from "@/lib/auth";
import { NextRequest } from "next/server";

const BASE_PATH = "/reservoir/creaseworks";

/**
 * Custom Auth.js route handler that bypasses next-auth's `reqWithEnvURL`.
 *
 * Calls `@auth/core`'s `Auth()` directly with a plain `Request` (not
 * `NextRequest`) so the URL is passed verbatim — no NextURL basePath
 * stripping that would break Auth.js's action regex.
 *
 * The basePath prepend is idempotent: Next.js *usually* strips the basePath
 * from `req.url` in route handlers, but Vercel rewrites can deliver the full
 * path. We normalise to always include the prefix exactly once.
 */
async function handler(req: NextRequest) {
  const url = new URL(req.url);

  // Ensure basePath appears exactly once in the pathname
  if (!url.pathname.startsWith(BASE_PATH)) {
    url.pathname = `${BASE_PATH}${url.pathname}`;
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Auth(request, authConfig as any) as Promise<Response>;
}

export { handler as GET, handler as POST };
