/**
 * LinkedIn token management — auto-refresh via Cloudflare Workers API.
 *
 * LinkedIn access tokens expire in 60 days. Refresh tokens last 365 days.
 * This module handles token refresh and updates wrangler secrets automatically.
 *
 * Flow:
 * 1. Cron job calls refreshLinkedInToken() monthly
 * 2. Uses LINKEDIN_REFRESH_TOKEN to get a new access token from LinkedIn
 * 3. Updates LINKEDIN_ACCESS_TOKEN via CF Workers API (replaces old Vercel path)
 * 4. If refresh token is also rotated, updates LINKEDIN_REFRESH_TOKEN too
 *
 * Required env vars for the auto-update:
 *   CF_ACCOUNT_ID       — Cloudflare account ID
 *   CF_API_TOKEN        — Cloudflare API token with Workers:Edit permission
 *   LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET — from LinkedIn app
 *   LINKEDIN_REFRESH_TOKEN — set after initial OAuth flow
 */

const LI_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

/** Refresh the LinkedIn access token using the refresh token. */
export async function refreshLinkedInToken(): Promise<{
  accessToken: string;
  expiresInDays: number;
  refreshTokenRotated: boolean;
}> {
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN;
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!refreshToken) throw new Error("LINKEDIN_REFRESH_TOKEN not set");
  if (!clientId) throw new Error("LINKEDIN_CLIENT_ID not set");
  if (!clientSecret) throw new Error("LINKEDIN_CLIENT_SECRET not set");

  const res = await fetch(LI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`linkedin token refresh failed: ${err}`);
  }

  const data: TokenResponse = await res.json();

  // Update secrets on CF Workers via Cloudflare API
  const cfAccountId = process.env.CF_ACCOUNT_ID;
  const cfApiToken = process.env.CF_API_TOKEN;
  const workerName = "wv-port";

  if (cfAccountId && cfApiToken) {
    await updateCfWorkerSecret(cfAccountId, cfApiToken, workerName, "LINKEDIN_ACCESS_TOKEN", data.access_token);

    if (data.refresh_token) {
      await updateCfWorkerSecret(cfAccountId, cfApiToken, workerName, "LINKEDIN_REFRESH_TOKEN", data.refresh_token);
    }
  } else {
    console.warn("[linkedin-token] CF_ACCOUNT_ID or CF_API_TOKEN not set — secrets not auto-updated. Set them manually.");
  }

  return {
    accessToken: data.access_token,
    expiresInDays: Math.round(data.expires_in / 86400),
    refreshTokenRotated: !!data.refresh_token,
  };
}

/** Update a CF Workers secret via Cloudflare API. */
async function updateCfWorkerSecret(
  accountId: string,
  apiToken: string,
  workerName: string,
  key: string,
  value: string,
): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/secrets`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: key, text: value, type: "secret_text" }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn(`[linkedin-token] failed to update CF secret ${key}: ${err.slice(0, 200)}`);
  }
}
