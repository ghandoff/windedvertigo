import { SignJWT, jwtVerify } from 'jose';

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'Set it in .env.local (dev) or Vercel Environment Variables (preview/production).'
  );
}
const JWT_SECRET = new TextEncoder().encode(rawSecret);

// Wave 7.0.7 — access tokens are short-lived (1h) so a stolen JWT is valid
// for at most 1h before the client is forced to refresh, at which point
// Notion is re-queried for current roles (revocation takes effect). Refresh
// tokens carry the long (7d) lifetime and are purpose-scoped so a stolen
// refresh token cannot be replayed as an access token.
export const ACCESS_TOKEN_TTL = '1h';
export const REFRESH_TOKEN_TTL = '7d';
export const ACCESS_COOKIE = 'sqr_token';
export const REFRESH_COOKIE = 'sqr_refresh';
export const ACCESS_MAX_AGE = 60 * 60;              // 1h
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;    // 7d

export async function signToken(payload, options = {}) {
  // Wave 7.0.7 — default shortened from 7d → 1h. Callers that explicitly
  // need long-lived tokens (refresh tokens, password-reset grants) pass
  // `expiresIn`. Legacy callers now inherit the safer default.
  const expiresIn = options.expiresIn || ACCESS_TOKEN_TTL;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

/** Wave 7.0.7 — issue a short-lived access token (1h). */
export async function signAccessToken(payload) {
  return signToken(payload, { expiresIn: ACCESS_TOKEN_TTL });
}

/**
 * Wave 7.0.7 — issue a long-lived refresh token (7d). Payload is
 * intentionally minimal: only the reviewerId, plus a `purpose: 'refresh'`
 * claim that the refresh endpoint asserts against (prevents a stolen
 * access token from being replayed as a refresh token).
 */
export async function signRefreshToken({ reviewerId }) {
  return signToken(
    { reviewerId, purpose: 'refresh' },
    { expiresIn: REFRESH_TOKEN_TTL },
  );
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
  return request.cookies?.get(ACCESS_COOKIE)?.value ?? null;
}

export function getRefreshTokenFromRequest(request) {
  return request.cookies?.get(REFRESH_COOKIE)?.value ?? null;
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
