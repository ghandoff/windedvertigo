import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getReviewerByAlias, createReviewer } from '@/lib/notion';
import { signToken } from '@/lib/auth';

const SALT_ROUNDS = 12;

export async function POST(request) {
  try {
    const data = await request.json();
    const required = ['firstName', 'lastName', 'email', 'alias', 'password'];
    for (const field of required) {
      if (!data[field]?.trim()) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }
    if (data.password.length < 12) {
      return NextResponse.json({ error: 'Password must be at least 12 characters long' }, { status: 400 });
    }
    const existing = await getReviewerByAlias(data.alias);
    if (existing) {
      return NextResponse.json({ error: 'This alias is already taken. Please choose another.' }, { status: 409 });
    }
    if (!data.consent) {
      return NextResponse.json({ error: 'You must consent to share your personal information' }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const page = await createReviewer({ firstName: data.firstName.trim(), lastName: data.lastName.trim(), email: data.email.trim(), affiliation: data.affiliation?.trim() || '', alias: data.alias.trim(), password: hashedPassword, discipline: data.discipline?.trim() || '', consent: true });
    const token = await signToken({ reviewerId: page.id, alias: data.alias.trim(), firstName: data.firstName.trim(), lastName: data.lastName.trim(), isAdmin: false });
    const response = NextResponse.json({ success: true, user: { id: page.id, alias: data.alias.trim(), firstName: data.firstName.trim(), lastName: data.lastName.trim(), isAdmin: false } });
    response.cookies.set('sqr_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
