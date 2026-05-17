import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Pre-warm the jose crypto path so the first real request doesn't pay the
// ~800ms V8 JIT-compilation cost.
//
// Why a valid token structure matters:
//   'x.x.x' decoded to invalid JSON and threw during header parsing — before
//   ever calling crypto.subtle. V8 never saw that code path and never compiled
//   it. This token has a proper HS256 header + empty payload so jose reaches
//   crypto.subtle.importKey + crypto.subtle.verify, which is exactly what we
//   need V8 to JIT-compile. The signature is intentionally wrong, so jose
//   throws "signature verification failed" — expected and swallowed.
//
// Why the await-gate in middleware():
//   A fire-and-forget IIFE races against the first fetch event — both fight
//   for V8 CPU time concurrently. The await-gate serializes them: compilation
//   finishes first, then the first real jwtVerify runs against compiled code.
//   _preWarmDone=true short-circuits the gate on every subsequent request
//   (zero overhead after warm-up).
const _WARMUP_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.e30.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
let _preWarmDone = false;
const _preWarm = jwtVerify(_WARMUP_TOKEN, JWT_SECRET)
  .catch(() => {})                       // expected: invalid signature
  .then(() => { _preWarmDone = true; });

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
  '/research', // Wave 7.2 Phase 2b — /research/pcs/* canonical PCS routes
  '/welcome',  // Wave 7.2 Phase 3 — unified post-login welcome
  '/studies',  // /studies/[id]/assisted-review — added Phase 3
];

export async function middleware(request) {
  // Await the pre-warm only on the first request so JIT compilation of the
  // crypto path completes before any real jwtVerify call. Once _preWarmDone
  // is true this is a single boolean check — no async overhead.
  if (!_preWarmDone) await _preWarm;

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
    '/research/:path*', // Wave 7.2 Phase 2b — /research/pcs/* canonical PCS routes
    '/welcome',         // Wave 7.2 Phase 3 — unified post-login welcome
    '/studies/:path*',
  ],
};
