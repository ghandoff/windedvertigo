/**
 * Gusto REST API client.
 *
 * Thin HTTP wrapper with OAuth token exchange and module-level caching.
 * Required env vars: GUSTO_CLIENT_ID, GUSTO_CLIENT_SECRET, GUSTO_COMPANY_UUID.
 * Optional: GUSTO_API_BASE (defaults to https://api.gusto.com).
 */

const GUSTO_API_BASE = process.env.GUSTO_API_BASE ?? "https://api.gusto.com";

// ── Types ──────────────────────────────────────────────────

export interface GustoEmployee {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  work_email: string | null;
}

export interface GustoContractor {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  type: "Individual" | "Business";
}

// ── Token cache ────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`[gusto] Missing required env var: ${name}`);
  }
  return val;
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = requireEnv("GUSTO_CLIENT_ID");
  const clientSecret = requireEnv("GUSTO_CLIENT_SECRET");

  const res = await fetch(`${GUSTO_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[gusto] OAuth token exchange failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Gusto tokens typically expire in 7200s; use their value or default to 2h
  tokenExpiresAt = Date.now() + (data.expires_in ?? 7200) * 1000;

  return cachedToken!;
}

// ── Generic helpers ────────────────────────────────────────

export async function gustoGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GUSTO_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[gusto] GET ${path} failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function gustoPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GUSTO_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[gusto] POST ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Roster helpers ─────────────────────────────────────────

export async function listEmployees(companyUuid: string): Promise<GustoEmployee[]> {
  return gustoGet<GustoEmployee[]>(`/v1/companies/${companyUuid}/employees`);
}

export async function listContractors(companyUuid: string): Promise<GustoContractor[]> {
  return gustoGet<GustoContractor[]>(`/v1/companies/${companyUuid}/contractors`);
}
