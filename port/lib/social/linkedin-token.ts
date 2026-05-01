/**
 * LinkedIn token management — auto-refresh via Vercel API.
 *
 * LinkedIn access tokens expire in 60 days. Refresh tokens last 365 days.
 * This module handles token refresh and updates the Vercel env var automatically.
 *
 * Flow:
 * 1. Cron job calls refreshLinkedInToken() monthly
 * 2. Uses LINKEDIN_REFRESH_TOKEN to get a new access token from LinkedIn
 * 3. Updates LINKEDIN_ACCESS_TOKEN on Vercel via their API
 * 4. If refresh token is also rotated, updates LINKEDIN_REFRESH_TOKEN too
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

  // Update env vars on Vercel
  const vercelToken = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID || "prj_rlsjo62EFnVofPUyjt0eYgzcrjmC";
  const teamId = process.env.VERCEL_TEAM_ID || "team_wrpRda7ZzXdu7nKcEVVXY3th";

  if (vercelToken) {
    await updateVercelEnv(vercelToken, projectId, teamId, "LINKEDIN_ACCESS_TOKEN", data.access_token);

    if (data.refresh_token) {
      await updateVercelEnv(vercelToken, projectId, teamId, "LINKEDIN_REFRESH_TOKEN", data.refresh_token);
    }
  }

  return {
    accessToken: data.access_token,
    expiresInDays: Math.round(data.expires_in / 86400),
    refreshTokenRotated: !!data.refresh_token,
  };
}

/** Update a Vercel env var by removing the old one and creating a new one. */
async function updateVercelEnv(
  token: string,
  projectId: string,
  teamId: string,
  key: string,
  value: string,
): Promise<void> {
  const baseUrl = `https://api.vercel.com/v10/projects/${projectId}/env`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Find existing env var ID
  const listRes = await fetch(`${baseUrl}?teamId=${teamId}`, { headers });
  if (!listRes.ok) return;

  const listData = await listRes.json();
  const existing = listData.envs?.find((e: { key: string }) => e.key === key);

  // Delete existing
  if (existing?.id) {
    await fetch(`${baseUrl}/${existing.id}?teamId=${teamId}`, {
      method: "DELETE",
      headers,
    });
  }

  // Create new
  await fetch(`${baseUrl}?teamId=${teamId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: ["production", "preview", "development"],
    }),
  });
}
