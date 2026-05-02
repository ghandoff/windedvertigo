import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/profile',
  '/analytics',
  '/network',
  '/reviews',
  '/intake',
  '/score',
  '/credibility',
  '/pcs',
  '/studies', // /studies/[id]/assisted-review — added Phase 3
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only protect app routes, not API routes (those handle their own auth)
  if (!PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('sqr_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    // Invalid or expired token — clear cookie and redirect to login
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('sqr_token');
    return response;
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/analytics/:path*',
    '/network/:path*',
    '/reviews/:path*',
    '/intake/:path*',
    '/score/:path*',
    '/credibility/:path*',
    '/pcs/:path*',
    '/studies/:path*',
  ],
};
