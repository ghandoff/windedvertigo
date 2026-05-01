/**
 * Unsubscribe URL helpers.
 *
 * Tokens are HMAC-SHA256 signed so no one can craft a token for an arbitrary
 * org ID. Format: `<base64url(orgId)>.<base64url(hmac)>`
 *
 * Secret: UNSUBSCRIBE_SECRET env var (falls back to NEXTAUTH_SECRET so no
 * extra config is needed for existing deployments).
 */

import { createHmac, timingSafeEqual } from "crypto";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://wv-port.vercel.app");

function getSecret(): string {
  // AUTH_SECRET is the Auth.js v5 name; NEXTAUTH_SECRET was the v4 name.
  // UNSUBSCRIBE_SECRET lets you use a dedicated key if you prefer.
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET, UNSUBSCRIBE_SECRET, or NEXTAUTH_SECRET must be set");
  return s;
}

function sign(orgId: string): string {
  return createHmac("sha256", getSecret()).update(orgId).digest("base64url");
}

export function buildUnsubscribeUrl(orgId: string): string {
  const payload = Buffer.from(orgId).toString("base64url");
  const sig = sign(orgId);
  return `${APP_URL}/unsubscribe?t=${payload}.${sig}`;
}

export function buildViewInBrowserUrl(draftId: string): string {
  return `${APP_URL}/view/${draftId}`;
}

/**
 * Decodes and verifies an unsubscribe token.
 * Returns the orgId on success, throws on invalid/tampered token.
 */
export function decodeUnsubscribeToken(token: string): string {
  const dot = token.lastIndexOf(".");
  if (dot === -1) throw new Error("Invalid token format");

  const payload = token.slice(0, dot);
  const receivedSig = token.slice(dot + 1);

  const orgId = Buffer.from(payload, "base64url").toString("utf-8");
  const expectedSig = sign(orgId);

  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(receivedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid token signature");
  }

  return orgId;
}
