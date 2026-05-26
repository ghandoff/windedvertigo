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

async function getTokenViaServiceAccount(
  saKeyJson: string,
  subjectOverride?: string,
): Promise<string | null> {
  let key: { client_email: string; private_key: string };
  try {
    key = JSON.parse(saKeyJson) as { client_email: string; private_key: string };
  } catch {
    console.warn("[gcal] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  // GOOGLE_IMPERSONATE_SUBJECT — if set, mint a JWT that acts AS that user
  // via Domain-Wide Delegation (configured in Workspace Admin → API controls).
  // Lets the SA access the user's personal calendar without an explicit share.
  // Leave unset to use plain SA mode (works for org-owned calendars shared
  // with the SA email).
  const impersonate = subjectOverride ?? process.env.GOOGLE_IMPERSONATE_SUBJECT;
  const payload: Record<string, unknown> = {
    iss: key.client_email,
    scope: GCAL_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  if (impersonate) payload.sub = impersonate;

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

/**
 * Mint a Calendar API access token. With multi-member support, callers can
 * pass `subject` to impersonate a specific Workspace user via DWD. When
 * omitted, falls back to env-default (GOOGLE_IMPERSONATE_SUBJECT) — same
 * behavior as the single-user gcal-sync that's been running.
 *
 * The legacy refresh-token path is kept for callers (createRfpDeadlineEvent)
 * that don't use DWD impersonation.
 */
async function getAccessToken(subject?: string): Promise<string | null> {
  const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saKeyJson) {
    return getTokenViaServiceAccount(saKeyJson, subject);
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

// ── W4 Council additions ─────────────────────────────────

export interface GcalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  organizer?: { email?: string };
  attendees?: Array<{ email: string; responseStatus?: string; self?: boolean }>;
  conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> };
  htmlLink?: string;
  // Calendar surfaces non-meeting event types: "default" (regular meeting),
  // "workingLocation" (Home/Office indicators), "focusTime", "outOfOffice".
  // Council only cares about default/meeting-style events.
  eventType?: string;
  // Per-event visibility set by the user in GCal: "default" (calendar's
  // default), "public", "private", or "confidential". When the user marks
  // an event private (e.g. therapy, doctor, personal), Council mirrors
  // that into the meetings row so it never appears on the team-shared list.
  visibility?: "default" | "public" | "private" | "confidential";
}

/**
 * List events on a calendar between timeMin and timeMax (ISO timestamps).
 * Uses service-account or refresh-token auth — same as createRfpDeadlineEvent.
 * Returns null on auth failure (caller should treat as "skip").
 */
export async function listEvents(
  timeMin: string,
  timeMax: string,
  calendarId = "primary",
  subject?: string,
): Promise<GcalEvent[] | null> {
  const accessToken = await getAccessToken(subject);
  if (!accessToken) {
    console.warn("[gcal] listEvents: no credentials");
    return null;
  }

  const events: GcalEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(
      `${GCAL_API}/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 401 || res.status === 403) {
      console.warn(`[gcal] listEvents auth ${res.status} — token missing scope or expired`);
      return null;
    }
    if (!res.ok) {
      const txt = await res.text();
      console.warn("[gcal] listEvents failed:", res.status, txt);
      break;
    }
    const data = (await res.json()) as { items?: GcalEvent[]; nextPageToken?: string };
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

/**
 * Patch an event — used to append the Council URL to the event description.
 *
 * Returns a tri-state result so callers can distinguish:
 *   - "ok"                  — patch landed
 *   - "skipped_permission"  — 403 from Google because the caller is an
 *                             attendee (not organizer) on the event/series;
 *                             EXPECTED failure on standing-meeting series we
 *                             don't own. Bucketed away from real errors.
 *   - "failed"              — anything else (auth missing, network, 404, etc.)
 *                             Real errors worth investigating.
 *
 * The ACL distinction matters because Workspace events you're invited to
 * (e.g. external client recurring syncs) reject single-instance description
 * patches with `forbiddenForNonOrganizer` per Google Calendar API rules.
 * Patching the SERIES instead would stamp every occurrence with one Council
 * URL, which is wrong — we want a per-meeting Council URL per occurrence.
 * So we accept the loss on non-owned events rather than corrupting the series.
 */
export type PatchEventResult = "ok" | "skipped_permission" | "failed";

export async function patchEvent(
  eventId: string,
  patch: Partial<{ description: string; summary: string }>,
  calendarId = "primary",
  subject?: string,
): Promise<PatchEventResult> {
  const accessToken = await getAccessToken(subject);
  if (!accessToken) {
    console.warn("[gcal] patchEvent: no credentials");
    return "failed";
  }
  const res = await fetch(
    `${GCAL_API}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    },
  );
  if (res.ok) return "ok";

  const txt = await res.text();
  // Detect "you're not the organizer" — expected on shared/attendee events.
  // Google surfaces this as 403 with reasons like 'forbiddenForNonOrganizer'
  // or 'requiredAccessLevel' in the response body.
  if (
    res.status === 403 &&
    /forbiddenForNonOrganizer|requiredAccessLevel|forbiddenForNonAttendee/i.test(txt)
  ) {
    return "skipped_permission";
  }
  console.warn(`[gcal] patchEvent ${eventId} failed:`, res.status, txt);
  return "failed";
}
