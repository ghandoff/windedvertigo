import { SignJWT, jwtVerify } from 'jose';

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = new TextEncoder().encode(rawSecret || 'dev-secret-change-in-production');

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/sqr_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function authenticateRequest(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Verify admin access by re-checking the Notion database.
 * Use on admin-protected routes instead of trusting the JWT isAdmin claim.
 * Dynamically imports notion.js to avoid circular dependency.
 */
export async function verifyAdminFromNotion(user) {
  if (!user?.reviewerId) return false;
  try {
    const { getReviewerById } = await import('@/lib/notion');
    const reviewer = await getReviewerById(user.reviewerId);
    return reviewer?.isAdmin === true;
  } catch {
    return false;
  }
}
