/**
 * Google Calendar REST API helper — RFP deadline event creation.
 *
 * Auth strategy (in priority order):
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON  — service account key JSON (compact string)
 *      Uses the same JWT-based token exchange as lib/gmail.ts (service account).
 *      Scope: https://www.googleapis.com/auth/calendar
 *   2. GOOGLE_CALENDAR_REFRESH_TOKEN + GOOGLE_CALENDAR_CLIENT_ID + GOOGLE_CALENDAR_CLIENT_SECRET
 *      OAuth refresh token (same env vars used by the meeting-briefings cron).
 *   3. Neither configured — logs a warning and skips silently.
 *
 * Callers MUST wrap invocations in .catch() — this helper never throws through
 * to the caller; all errors are caught and logged internally.
 */

import { createSign } from "crypto";
import type { RfpOpportunity } from "@/lib/notion/types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GCAL_API = "https://www.googleapis.com/calendar/v3/calendars";
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar";

// ── token helpers ─────────────────────────────────────────

async function getTokenViaRefresh(): Promise<string | null> {
  const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN } =
    process.env;

  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET || !GOOGLE_CALENDAR_REFRESH_TOKEN) {
    return null;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: GOOGLE_CALENDAR_CLIENT_SECRET,
      refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[gcal] OAuth token refresh failed:", text);
    return null;
  }

  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function getTokenViaServiceAccount(saKeyJson: string): Promise<string | null> {
  let key: { client_email: string; private_key: string };
  try {
    key = JSON.parse(saKeyJson) as { client_email: string; private_key: string };
  } catch {
    console.warn("[gcal] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    scope: GCAL_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${b64url(header)}.${b64url(payload)}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(key.private_key, "base64url");

  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[gcal] Service account token exchange failed:", text);
    return null;
  }

  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function getAccessToken(): Promise<string | null> {
  const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saKeyJson) {
    return getTokenViaServiceAccount(saKeyJson);
  }
  return getTokenViaRefresh();
}

// ── public API ────────────────────────────────────────────

/**
 * Create an all-day Google Calendar event on the `primary` calendar for an RFP
 * submission deadline. Silently skips if `rfp.dueDate?.start` is not set.
 *
 * Failures are caught internally and logged — this function never throws.
 */
export async function createRfpDeadlineEvent(rfp: RfpOpportunity): Promise<void> {
  try {
    if (!rfp.dueDate?.start) {
      console.log(`[gcal] skipping event creation for "${rfp.opportunityName}" — no due date`);
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn(
        "[gcal] no Google credentials configured " +
          "(GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CALENDAR_REFRESH_TOKEN) — skipping event creation",
      );
      return;
    }

    const date = rfp.dueDate.start; // YYYY-MM-DD string from Notion DateRange

    const event = {
      summary: `[RFP] ${rfp.opportunityName} — submission due`,
      description: "Auto-created by RFP Lighthouse when opportunity moved to pursuing.",
      start: { date },
      end: { date },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 5 * 24 * 60 },
          { method: "popup", minutes: 5 * 24 * 60 },
        ],
      },
    };

    const res = await fetch(`${GCAL_API}/primary/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[gcal] failed to create event for "${rfp.opportunityName}":`, text);
      return;
    }

    const created = await res.json() as { id?: string; htmlLink?: string };
    console.log(
      `[gcal] created deadline event for "${rfp.opportunityName}" (id: ${created.id ?? "unknown"})`,
    );
  } catch (err) {
    console.warn(`[gcal] unexpected error creating event for "${rfp.opportunityName}":`, err);
  }
}
