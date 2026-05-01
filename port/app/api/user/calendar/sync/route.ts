/**
 * POST /api/user/calendar/sync
 *
 * On-demand sync of the authenticated user's Google Calendar into the
 * Notion timesheets database. Works for any date range — used for both
 * daily top-ups and full historical backfill (e.g. since Jan 1 2026).
 *
 * Body: { from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" }
 *   from defaults to Jan 1 of the current year
 *   to   defaults to today
 *
 * Requires:
 *   - Valid Auth.js session with Google calendar scope (user must have
 *     signed in after the calendar scope was added to the auth config)
 *   - Session accessToken stored in JWT (see lib/shared/auth/index.ts)
 *
 * Returns:
 *   { ok, from, to, totalEvents, created, skipped, errors[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTimesheet, queryTimesheets } from "@/lib/notion/timesheets";
import { getNotionUserMap } from "@/lib/role";

// ── Google Calendar helpers ──────────────────────────────

interface CalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
  attendees?: Array<{ email: string; self?: boolean; responseStatus?: string }>;
}

function eventDurationHours(event: CalendarEvent): number {
  const start = event.start.dateTime;
  const end   = event.end.dateTime;
  if (!start || !end) return 0; // all-day events have no dateTime
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

/**
 * Returns null if the token lacks calendar scope (401/403 from Google).
 * Returns an empty array only when the date range genuinely has no events.
 */
async function fetchCalendarEvents(
  accessToken: string,
  from: string,
  to: string,
): Promise<CalendarEvent[] | null> {
  const calendarId = "primary";
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin:       new Date(from).toISOString(),
      timeMax:       new Date(`${to}T23:59:59`).toISOString(),
      singleEvents:  "true",
      orderBy:       "startTime",
      maxResults:    "250",
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    // 401 = token expired; 403 = missing calendar scope (token pre-dates scope addition).
    // Both cases require the user to sign out and back in.
    if (res.status === 401 || res.status === 403) {
      console.warn(`[calendar/sync] Google returned ${res.status} — token missing calendar scope or expired`);
      return null;
    }

    if (!res.ok) {
      console.error("[calendar/sync] Google Calendar API error:", res.status, await res.text());
      break;
    }

    const data = await res.json() as { items?: CalendarEvent[]; nextPageToken?: string };
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

// ── Handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The access token is injected into the session by the jwt callback
  // only when the user has signed in with the calendar scope granted.
  const accessToken = (session as unknown as Record<string, unknown>).accessToken as string | undefined;
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "no_calendar_token",
        message: "Please sign out and sign back in — you'll see a Google prompt to allow calendar access.",
      },
      { status: 403 },
    );
  }

  // Parse date range from request body
  const body = await req.json().catch(() => ({})) as { from?: string; to?: string };
  const thisYear = new Date().getFullYear();
  const from = body.from ?? `${thisYear}-01-01`;
  const to   = body.to   ?? new Date().toISOString().split("T")[0];

  const email = session.user.email;

  // Resolve this user's Notion person ID so entries are attributed to them
  const notionUserMap = await getNotionUserMap();
  const personId = notionUserMap.get(email.toLowerCase()) ?? null;

  console.log(`[calendar/sync] user=${email} personId=${personId ?? "not found"} range=${from}→${to}`);

  // Fetch all calendar events in the date range (handles pagination automatically).
  // Returns null when the token lacks calendar scope — user must re-authenticate.
  const allEvents = await fetchCalendarEvents(accessToken, from, to);
  if (allEvents === null) {
    return NextResponse.json(
      {
        error: "no_calendar_token",
        message: "Your session doesn't have calendar access. Please sign out and sign back in — Google will ask you to allow calendar access.",
      },
      { status: 403 },
    );
  }

  // Keep only events the user accepted with a real duration (not all-day, not cancelled)
  const validEvents = allEvents.filter((ev) => {
    if (ev.status === "cancelled") return false;
    if (eventDurationHours(ev) <= 0) return false;
    const selfAttendee = ev.attendees?.find((a) => a.self);
    if (selfAttendee?.responseStatus === "declined") return false;
    return true;
  });

  // Fetch existing entries for this period (by person) to avoid duplicates.
  // Key: "<lowercase name>:<date>" — same dedup logic as the daily cron.
  const { data: existing } = await queryTimesheets(
    {
      dateAfter:  from,
      dateBefore: to,
      ...(personId ? { personId } : {}),
    },
    { pageSize: 500 },
  );
  const existingKeys = new Set(
    existing.map((e) => `${e.entry.toLowerCase()}:${e.dateAndTime?.start ?? ""}`),
  );

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const event of validEvents) {
    const name    = (event.summary ?? "untitled event").trim();
    const dateStr = (event.start.dateTime ?? event.start.date ?? "").split("T")[0];
    if (!dateStr) { skipped++; continue; }

    const key = `${name.toLowerCase()}:${dateStr}`;
    if (existingKeys.has(key)) { skipped++; continue; }

    const hours = Math.round(eventDurationHours(event) * 100) / 100;

    try {
      await createTimesheet({
        entry:       name,
        hours,
        status:      "draft",
        billable:    false,
        dateAndTime: { start: dateStr, end: null },
        ...(personId ? { personIds: [personId] } : {}),
      });
      existingKeys.add(key); // prevent in-batch duplicates
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[calendar/sync] failed to create "${name}":`, msg);
      if (errors.length < 5) errors.push(`${name}: ${msg}`);
    }
  }

  console.log(`[calendar/sync] done user=${email} total=${validEvents.length} created=${created} skipped=${skipped}`);

  return NextResponse.json({
    ok:          true,
    from,
    to,
    totalEvents: validEvents.length,
    created,
    skipped,
    errors,
  });
}
