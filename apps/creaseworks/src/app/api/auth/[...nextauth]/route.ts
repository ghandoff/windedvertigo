import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

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

