/**
 * Auth middleware — protect all CRM routes except login and API auth.
 *
 * Unauthenticated users are redirected to /crm/login.
 * API routes (except /api/auth) return 401 instead of redirecting.
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow auth routes and the login page through
  if (
    pathname.startsWith("/crm/api/auth") ||
    pathname === "/crm/login" ||
    pathname.startsWith("/crm/_next") ||
    pathname.startsWith("/crm/favicon") ||
    pathname === "/crm/sw.js" ||
    pathname === "/crm/manifest.json" ||
    pathname.startsWith("/crm/images/")
  ) {
    return NextResponse.next();
  }

  // Not authenticated
  if (!req.auth) {
    // API routes get 401
    if (pathname.startsWith("/crm/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pages get redirected to login
    const loginUrl = new URL("/crm/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/crm/:path*"],
};
