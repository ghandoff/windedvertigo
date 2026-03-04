import { Auth } from "@auth/core";
import { authConfig } from "@/lib/auth";
import { NextRequest } from "next/server";

const BASE_PATH = "/reservoir/deep-deck";

/**
 * Custom Auth.js route handler that bypasses next-auth's reqWithEnvURL.
 * Same pattern as creaseworks — ensures basePath is preserved correctly.
 */
async function handler(req: NextRequest) {
  const url = new URL(req.url);

  if (!url.pathname.startsWith(BASE_PATH)) {
    url.pathname = `${BASE_PATH}${url.pathname}`;
  }

  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (authUrl) {
    const envOrigin = new URL(authUrl);
    url.protocol = envOrigin.protocol;
    url.host = envOrigin.host;
  }

  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    // @ts-expect-error duplex required for streaming request bodies
    duplex: "half",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Auth(request, authConfig as any) as Promise<Response>;
}

export { handler as GET, handler as POST };
