/**
 * GET /api/debug/calendar-probe — temporary diagnostic endpoint
 * Makes a direct Google Calendar API call and returns the raw response,
 * so we can see exactly what error Google is returning.
 * Delete after debugging.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const s = session as unknown as Record<string, unknown>;
  const accessToken = s.accessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "no access token in session" });

  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1).toISOString();
  const params = new URLSearchParams({
    timeMin:      jan1,
    timeMax:      now.toISOString(),
    singleEvents: "true",
    maxResults:   "5",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const body = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { parsed = body; }

  return NextResponse.json({
    calendarApiStatus: res.status,
    calendarApiHeaders: Object.fromEntries(res.headers.entries()),
    calendarApiBody: parsed,
  });
}
