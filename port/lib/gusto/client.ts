/**
 * Gusto REST API client.
 *
 * Uses OAuth 2.0 authorization_code + refresh_token flow.
 * Run GET /api/gusto/authorize once to get the initial token pair,
 * then store GUSTO_REFRESH_TOKEN in Vercel env vars.
 *
 * Required env vars:
 *   GUSTO_CLIENT_ID      — from dev.gusto.com application
 *   GUSTO_CLIENT_SECRET  — from dev.gusto.com application
 *   GUSTO_REFRESH_TOKEN  — obtained via one-time OAuth flow
 *   GUSTO_COMPANY_UUID   — winded.vertigo LLC: 1be7612b-b886-475e-b76f-a28af4624a16
 *
 * Optional:
 *   GUSTO_API_BASE       — defaults to https://api.gusto.com
 *   NEXT_PUBLIC_APP_URL  — defaults to https://port.windedvertigo.com
 */

const GUSTO_API_BASE = process.env.GUSTO_API_BASE ?? "https://api.gusto.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://port.windedvertigo.com";

// ── Types ──────────────────────────────────────────────────

export interface GustoEmployee {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  work_email: string | null;
  jobs?: Array<{
    uuid: string;
    current_compensation_uuid: string;
    payment_unit: "Hour" | "Week" | "Month" | "Year" | "Paycheck";
    rate: string;
  }>;
}

export interface GustoPayrollPeriod {
  start_date: string;
  end_date: string;
}

export interface GustoPayroll {
  uuid: string;
  version: string;
  processed: boolean;
  pay_period: GustoPayrollPeriod;
  check_date: string;
  payroll_deadline: string;
  employee_compensations: GustoEmployeeCompensation[];
}

export interface GustoEmployeeCompensation {
  employee_uuid: string;
  hourly_compensations: Array<{
    name: string;
    hours: string;
    job_uuid: string;
    compensation_multiplier: number;
  }>;
  fixed_compensations: Array<{
    name: string;
    amount: string;
    job_uuid: string;
  }>;
}

// ── Token cache ────────────────────────────────────────────

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokenExpiresAt = 0;

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`[gusto] Missing required env var: ${name}`);
  return val;
}

/**
 * Get a valid access token, using the cached token or refreshing via the
 * stored refresh token. On successful refresh, updates the in-memory cache.
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = requireEnv("GUSTO_CLIENT_ID");
  const clientSecret = requireEnv("GUSTO_CLIENT_SECRET");
  const refreshToken = cachedRefreshToken ?? requireEnv("GUSTO_REFRESH_TOKEN");
  const redirectUri = `${APP_URL}/api/gusto/callback`;

  const res = await fetch(`${GUSTO_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[gusto] Token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  cachedToken = data.access_token as string;
  // Gusto issues a new refresh token on each refresh — cache it
  if (data.refresh_token) cachedRefreshToken = data.refresh_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 7200) * 1000;

  return cachedToken!;
}

// ── Generic HTTP helpers ───────────────────────────────────

export async function gustoGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GUSTO_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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

export async function gustoPut<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GUSTO_API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[gusto] PUT ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Roster helpers ─────────────────────────────────────────

export async function listEmployees(companyUuid: string): Promise<GustoEmployee[]> {
  return gustoGet<GustoEmployee[]>(
    `/v1/companies/${companyUuid}/employees?include=all_compensations`,
  );
}

// ── Payroll helpers ────────────────────────────────────────

/**
 * Find the unprocessed payroll whose pay period contains the given ISO date.
 * Returns null if no open payroll exists for that date.
 */
export async function findOpenPayroll(
  companyUuid: string,
  dateStr: string,
): Promise<GustoPayroll | null> {
  const payrolls = await gustoGet<GustoPayroll[]>(
    `/v1/companies/${companyUuid}/payrolls?processing_statuses=unprocessed&include=employee_compensations`,
  );
  const target = new Date(dateStr).getTime();
  return (
    payrolls.find((p) => {
      const start = new Date(p.pay_period.start_date).getTime();
      const end = new Date(p.pay_period.end_date).getTime() + 86_400_000; // inclusive
      return target >= start && target <= end;
    }) ?? null
  );
}

/**
 * Update an employee's Regular hours in an unprocessed payroll.
 * Fetches the payroll first to get the current version (optimistic locking).
 */
export async function putEmployeeHours(
  companyUuid: string,
  payrollUuid: string,
  employeeUuid: string,
  jobUuid: string,
  hours: number,
): Promise<GustoPayroll> {
  // Get current version for optimistic locking
  const payroll = await gustoGet<GustoPayroll>(
    `/v1/companies/${companyUuid}/payrolls/${payrollUuid}?include=employee_compensations`,
  );

  return gustoPut<GustoPayroll>(
    `/v1/companies/${companyUuid}/payrolls/${payrollUuid}`,
    {
      version: payroll.version,
      employee_compensations: [
        {
          employee_uuid: employeeUuid,
          hourly_compensations: [
            {
              name: "Regular",
              hours: hours.toFixed(2),
              job_uuid: jobUuid,
            },
          ],
          fixed_compensations: [],
        },
      ],
    },
  );
}
