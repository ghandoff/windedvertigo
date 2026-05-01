export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // protect plan pages — require auth for server-side session
    // but don't block API routes (they handle auth optionally)
    "/plan/:path*",
    "/login",
  ],
};
