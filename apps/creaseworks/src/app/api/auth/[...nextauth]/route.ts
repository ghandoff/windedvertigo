import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

/**
 * Next.js strips its own basePath ("/reservoir/creaseworks") from the request
 * URL before it reaches route handlers. Auth.js however needs the full path
 * (including the basePath prefix) to match actions and build correct callback
 * URLs for OAuth providers. We re-add the stripped prefix here so Auth.js sees
 * the canonical external URL.
 */
function withBasePath(
  handler: (req: NextRequest) => Promise<Response>,
) {
  return async (req: NextRequest) => {
    const url = new URL(req.url);
    url.pathname = `/reservoir/creaseworks${url.pathname}`;
    return handler(new NextRequest(url.toString(), req));
  };
}

export const GET = withBasePath(handlers.GET);
export const POST = withBasePath(handlers.POST);
