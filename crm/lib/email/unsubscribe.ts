/**
 * Unsubscribe URL helpers.
 *
 * Tokens are base64url-encoded org IDs — simple and sufficient for a
 * personal CRM. Can be upgraded to HMAC-signed tokens if needed.
 */

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://wv-crm.vercel.app");

export function buildUnsubscribeUrl(orgId: string): string {
  const token = Buffer.from(orgId).toString("base64url");
  return `${APP_URL}/unsubscribe?t=${token}`;
}

export function buildViewInBrowserUrl(draftId: string): string {
  return `${APP_URL}/view/${draftId}`;
}

export function decodeUnsubscribeToken(token: string): string {
  return Buffer.from(token, "base64url").toString("utf-8");
}
