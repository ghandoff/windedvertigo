import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ user });
}
