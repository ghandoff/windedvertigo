import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, authenticateRequest } from '@/lib/auth';

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (user) {
    return NextResponse.json({ user });
  }
  // Anonymous visitor (no access cookie) is not an auth failure — it's the
  // answer "no one is logged in." Return 200 so the browser console stays
  // clean on every public page load. Token-present-but-invalid still 401s
  // so the silent-refresh path in useAuth.js kicks in (Wave 7.0.7).
  if (!request.cookies?.get(ACCESS_COOKIE)?.value) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}
