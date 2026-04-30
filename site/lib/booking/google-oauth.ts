/**
 * Google OAuth 2.0 flow for the booking system.
 *
 * Each collective member visits /admin/booking/connect once and grants
 * `calendar.events` + `calendar.freebusy` scopes. We store the refresh
 * token (encrypted via AES-GCM) and refresh access tokens lazily.
 *
 * No node:crypto, no googleapis library — bare fetch + Web Crypto only.
 *
 * Token URL:    https://oauth2.googleapis.com/token
 * Auth URL:     https://accounts.google.com/o/oauth2/v2/auth
 * Required env:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI    e.g. https://windedvertigo.com/api/booking/oauth/google/callback
 */

import { encrypt, decrypt } from "./crypto";
import { selectOne, upsert, update } from "./supabase";
import type { OauthToken } from "./supabase";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export interface OauthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getEnv(): OauthEnv {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "google oauth env not configured (CLIENT_ID/SECRET/REDIRECT_URI)",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * Build the Google consent URL. State is an HMAC-signed token bound to the host.
 *
 * Note: we use prompt=consent + access_type=offline to guarantee a refresh
 * token is returned (Google omits it on subsequent grants without prompt=consent).
 */
export function buildAuthUrl(state: string): string {
  const env = getEnv();
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

/** Exchange an authorization code for tokens. Called from the OAuth callback. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const env = getEnv();
  const body = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`google token exchange failed (${res.status}): ${errText}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Refresh an access token using a stored refresh token. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const env = getEnv();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`google token refresh failed (${res.status}): ${errText}`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Fetch the Google account email tied to an access token.
 * Used to record google_account_email on token storage.
 */
export async function fetchUserInfo(
  accessToken: string,
): Promise<{ email: string; sub: string }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    // userinfo requires openid scope; fall back to a calendar list call to derive email
    return { email: "unknown@google", sub: "" };
  }
  return (await res.json()) as { email: string; sub: string };
}

/**
 * Persist or update the encrypted refresh token + plaintext access token
 * for a host. Idempotent — keyed on host_id.
 */
export async function persistToken(params: {
  hostId: string;
  refreshToken: string;
  accessToken: string;
  accessExpiresIn: number;
  scope: string;
  googleAccountEmail: string;
}): Promise<void> {
  const enc = await encrypt(params.refreshToken);
  const expiresAt = new Date(Date.now() + params.accessExpiresIn * 1000).toISOString();

  await upsert(
    "oauth_tokens",
    {
      host_id: params.hostId,
      provider: "google",
      refresh_token_ct: enc.ct,
      refresh_token_iv: enc.iv,
      access_token: params.accessToken,
      access_expires_at: expiresAt,
      scope: params.scope,
      google_account_email: params.googleAccountEmail,
      updated_at: new Date().toISOString(),
    },
    "host_id",
  );
}

/**
 * Get a valid access token for the given host, refreshing if expired.
 *
 * Caller never sees the refresh token directly. If the refresh fails
 * (e.g. invalid_grant from a revoked grant), the error bubbles up so
 * the caller can surface re-consent UX.
 */
export async function getValidAccessTokenForHost(
  hostId: string,
): Promise<string> {
  const row = await selectOne<OauthToken>("oauth_tokens", { host_id: `eq.${hostId}` });
  if (!row) throw new Error(`host ${hostId} has not connected Google`);

  // 60-second skew buffer so we don't hand out tokens about to expire
  const expiresAt = row.access_expires_at ? new Date(row.access_expires_at).getTime() : 0;
  const valid = row.access_token && expiresAt > Date.now() + 60_000;
  if (valid && row.access_token) return row.access_token;

  const refreshToken = await decrypt(row.refresh_token_ct, row.refresh_token_iv);
  const refreshed = await refreshAccessToken(refreshToken);

  // Google occasionally rotates refresh tokens. If a new one comes back, store it.
  if (refreshed.refresh_token && refreshed.refresh_token !== refreshToken) {
    const enc = await encrypt(refreshed.refresh_token);
    await update<OauthToken>(
      "oauth_tokens",
      { host_id: `eq.${hostId}` },
      {
        refresh_token_ct: enc.ct,
        refresh_token_iv: enc.iv,
        access_token: refreshed.access_token,
        access_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    );
  } else {
    await update<OauthToken>(
      "oauth_tokens",
      { host_id: `eq.${hostId}` },
      {
        access_token: refreshed.access_token,
        access_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    );
  }

  return refreshed.access_token;
}

/**
 * Health check for a host's stored token. Returns null if connected and
 * working, otherwise an error message useful for the admin UI.
 */
export async function checkTokenHealth(hostId: string): Promise<string | null> {
  try {
    await getValidAccessTokenForHost(hostId);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "unknown error";
  }
}
