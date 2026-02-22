import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getReviewerByAlias, updateReviewerPassword } from '@/lib/notion';
import { signToken } from '@/lib/auth';

const SALT_ROUNDS = 12;

export async function POST(request) {
  try {
    const { alias, password } = await request.json();
    if (!alias || !password) {
      return NextResponse.json({ error: 'Alias and password are required' }, { status: 400 });
    }
    const reviewer = await getReviewerByAlias(alias);
    if (!reviewer) {
      return NextResponse.json({ error: 'Invalid alias or password' }, { status: 401 });
    }
    const storedPassword = reviewer.properties?.['Password']?.rich_text?.[0]?.plain_text || '';

    // Check if stored password is a bcrypt hash (starts with $2a$ or $2b$)
    const isHashed = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$');

    let passwordValid = false;
    if (isHashed) {
      passwordValid = await bcrypt.compare(password, storedPassword);
    } else {
      // Legacy plain-text comparison — migrate to hash on successful login
      passwordValid = storedPassword === password;
      if (passwordValid) {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await updateReviewerPassword(reviewer.id, hashedPassword);
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid alias or password' }, { status: 401 });
    }
    const firstName = reviewer.properties?.['First Name']?.title?.[0]?.plain_text || '';
    const lastName = reviewer.properties?.['Last Name (Surname)']?.rich_text?.[0]?.plain_text || '';
    const reviewerAlias = reviewer.properties?.['Alias']?.rich_text?.[0]?.plain_text || alias;
    const isAdmin = reviewer.properties?.['Admin']?.checkbox || false;
    const token = await signToken({ reviewerId: reviewer.id, alias: reviewerAlias, firstName, lastName, isAdmin });
    const response = NextResponse.json({ success: true, user: { id: reviewer.id, alias: reviewerAlias, firstName, lastName, isAdmin } });
    response.cookies.set('sqr_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
