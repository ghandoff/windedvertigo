import { NextRequest, NextResponse } from "next/server";

const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const COOKIE_NAME = "__wv_utm";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hasUtm = UTM_PARAMS.some((p) => url.searchParams.has(p));

  if (!hasUtm) return NextResponse.next();

  const utm: Record<string, string> = {};
  for (const param of UTM_PARAMS) {
    const val = url.searchParams.get(param);
    if (val) utm[param] = val;
  }
  utm.landed_at = new Date().toISOString();

  const res = NextResponse.next();
  res.cookies.set(COOKIE_NAME, JSON.stringify(utm), {
    httpOnly: false, // readable by client-side tracker
    secure: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return res;
}

export const config = {
  matcher: [
    // Match all pages but skip static assets, API routes, and Next.js internals
    "/((?!_next/static|_next/image|favicon\\.ico|images/).*)",
  ],
};
