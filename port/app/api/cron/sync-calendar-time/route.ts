/**
 * GET /api/cron/sync-calendar-time
 *
 * Runs daily — creates draft timesheet entries from yesterday's Google Calendar events.
 * Team members confirm/adjust via mobile Log tab.
 *
 * Logic:
 *   1. Fetch yesterday's calendar events (only accepted, with duration > 0)
 *   2. Skip all-day events and events already synced (check by entry name + date)
 *   3. Create draft timesheet entry per event
 *   4. Link to matching work items if event summary contains a project keyword
 *
 * Requires env vars:
 *   GOOGLE_CALENDAR_CLIENT_ID
 *   GOOGLE_CALENDAR_CLIENT_SECRET
 *   GOOGLE_CALENDAR_REFRESH_TOKEN
 *   GOOGLE_CALENDAR_ID  (defaults to "primary")
 *   CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { createTimesheet, queryTimesheets } from "@/lib/notion/timesheets";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

// ── Google Calendar REST API ──────────────────────────────

async function getGoogleAccessToken(): Promise<string | null> {
  const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN } =
    process.env;

  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET || !GOOGLE_CALENDAR_REFRESH_TOKEN) {
    return null;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: GOOGLE_CALENDAR_CLIENT_SECRET,
      refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
  attendees?: Array<{ email: string; self?: boolean; responseStatus?: string }>;
}

async function getYesterdayEvents(accessToken: string): Promise<CalendarEvent[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  const now = new Date();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const params = new URLSearchParams({
    timeMin: startOfYesterday.toISOString(),
    timeMax: endOfYesterday.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as CalendarEvent[];
}

function eventDurationHours(event: CalendarEvent): number {
  const start = event.start.dateTime;
  const end = event.end.dateTime;
  if (!start || !end) return 0; // all-day events have no dateTime
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

// ── Main handler ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "google calendar credentials not configured" },
      { status: 500 },
    );
  }

  const events = await getYesterdayEvents(accessToken);

  // Filter to valid events: has duration, not cancelled, not declined
  const validEvents = events.filter((ev) => {
    if (ev.status === "cancelled") return false;
    if (eventDurationHours(ev) <= 0) return false;
    // If user declined, skip
    const selfAttendee = ev.attendees?.find((a) => a.self);
    if (selfAttendee?.responseStatus === "declined") return false;
    return true;
  });

  if (validEvents.length === 0) {
    return NextResponse.json({ message: "no events to sync", created: 0 });
  }

  // Check for already-synced entries (by date)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  const { data: existing } = await queryTimesheets(
    { dateAfter: dateStr, dateBefore: dateStr },
    { pageSize: 100 },
  );
  const existingNames = new Set(existing.map((e) => e.entry.toLowerCase()));

  let created = 0;

  for (const event of validEvents) {
    const name = (event.summary ?? "untitled event").trim();
    // Skip if we already have an entry with this name on this date
    if (existingNames.has(name.toLowerCase())) continue;

    const hours = Math.round(eventDurationHours(event) * 100) / 100;

    try {
      await createTimesheet({
        entry: name,
        hours,
        status: "draft",
        billable: false, // default to non-billable, team confirms
        dateAndTime: { start: dateStr, end: null },
      });
      created++;
    } catch (err) {
      console.error(`Failed to create timesheet for "${name}":`, err);
    }
  }

  return NextResponse.json({
    message: `synced ${created} calendar events as draft timesheets`,
    created,
    totalEvents: validEvents.length,
    skipped: validEvents.length - created,
  });
}
