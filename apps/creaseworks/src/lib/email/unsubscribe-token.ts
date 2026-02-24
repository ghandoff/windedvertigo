/**
 * HMAC-based unsubscribe tokens.
 *
 * Session 21: one-click email unsubscribe support.
 *
 * Generates and verifies tokens so users can unsubscribe from digest
 * emails without logging in. Token format: base64url(userId:timestamp:hmac).
 * Tokens expire after 90 days.
 */

import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.CRON_SECRET ?? "dev-secret";
const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function hmac(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

/**
 * Generate a one-click unsubscribe token for a given userId.
 */
export function generateUnsubscribeToken(userId: string): string {
  const ts = Date.now().toString(36);
  const payload = `${userId}:${ts}`;
  const sig = hmac(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * Verify and decode an unsubscribe token.
 * Returns the userId if valid, null otherwise.
 */
export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;

    const [userId, ts, sig] = parts;
    const payload = `${userId}:${ts}`;
    const expected = hmac(payload);

    // Timing-safe comparison
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    // Check expiry
    const timestamp = parseInt(ts, 36);
    if (Date.now() - timestamp > TOKEN_MAX_AGE_MS) return null;

    return userId;
  } catch {
    return null;
  }
}

/**
 * Build the full unsubscribe URL for a user.
 */
export function buildUnsubscribeUrl(userId: string): string {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const token = generateUnsubscribeToken(userId);
  return `${baseUrl}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`;
}
