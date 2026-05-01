/**
 * GET /api/cron/meeting-briefings
 *
 * Runs daily at 7:30am ET (11:30am UTC) — before the workday starts.
 * For each meeting today with external attendees, generates a one-paragraph
 * port briefing from org/contact data and posts it to Slack.
 *
 * Requires env vars:
 *   GOOGLE_CALENDAR_CLIENT_ID
 *   GOOGLE_CALENDAR_CLIENT_SECRET
 *   GOOGLE_CALENDAR_REFRESH_TOKEN
 *   GOOGLE_CALENDAR_ID  (defaults to "primary")
 */

import { NextRequest, NextResponse } from "next/server";
import { queryContacts } from "@/lib/notion/contacts";
import { getOrganization } from "@/lib/notion/organizations";
import { getActivitiesForOrg } from "@/lib/notion/activities";
import { callClaude } from "@/lib/ai/client";
import { postToSlack } from "@/lib/slack";

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
  attendees?: Array<{ email: string; displayName?: string; self?: boolean }>;
}

async function getTodayEvents(accessToken: string): Promise<CalendarEvent[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
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

// ── port matching ──────────────────────────────────────────

async function findCrmContext(externalEmails: string[]) {
  if (externalEmails.length === 0) return null;

  // Search contacts by email
  const contactResults = await Promise.allSettled(
    externalEmails.map((email) => queryContacts({ search: email }, { pageSize: 3 })),
  );

  const matchedContacts = contactResults
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<{ data: unknown[] }>).value.data)
    .slice(0, 5);

  if (matchedContacts.length === 0) return null;

  // Get org context from the first matched contact's org
  const contact = matchedContacts[0] as { organizationIds?: string[]; name?: string };
  const orgId = contact.organizationIds?.[0];
  if (!orgId) return { contacts: matchedContacts, org: null, activities: [] };

  const [orgRes, activitiesRes] = await Promise.allSettled([
    getOrganization(orgId),
    getActivitiesForOrg(orgId),
  ]);

  return {
    contacts: matchedContacts,
    org: orgRes.status === "fulfilled" ? orgRes.value : null,
    activities: activitiesRes.status === "fulfilled" ? activitiesRes.value.data.slice(0, 5) : [],
  };
}

// ── briefing generator ────────────────────────────────────

async function generateBriefing(
  event: CalendarEvent,
  context: Awaited<ReturnType<typeof findCrmContext>>,
): Promise<string> {
  const contact = context?.contacts[0] as {
    name?: string;
    role?: string;
    contactWarmth?: string;
    relationshipStage?: string;
  } | undefined;

  const org = context?.org as {
    organization?: string;
    connection?: string;
    outreachStatus?: string;
    notes?: string;
  } | null;

  const recentActivities = (context?.activities ?? [])
    .slice(0, 3)
    .map((a) =>
      `${a.date?.start ?? a.createdTime.split("T")[0]}: ${a.activity} (${a.outcome ?? "no outcome"})`,
    )
    .join("\n");

  const userMessage = `Generate a brief pre-meeting port briefing (3-4 sentences max).

Meeting: ${event.summary}
Time: ${event.start.dateTime ?? event.start.date}

${contact ? `Contact: ${contact.name ?? "unknown"} — ${contact.role ?? ""} — warmth: ${contact.contactWarmth ?? "unknown"} — stage: ${contact.relationshipStage ?? "unknown"}` : "No contact match found in port."}

${org ? `Organization: ${org.organization} — connection: ${org.connection} — outreach: ${org.outreachStatus}` : ""}

${recentActivities ? `Recent activities:\n${recentActivities}` : "No recent activities on record."}

${org ? `Org notes: ${(org.notes ?? "").slice(0, 300)}` : ""}

Write a practical 2-3 sentence briefing for what to know going into this meeting. Focus on relationship status, last interaction, and any open threads.`;

  const result = await callClaude({
    feature: "relationship-score",
    system: "You write concise pre-meeting port briefings for a learning design consultancy. Be specific and practical.",
    userMessage,
    userId: "cron",
    maxTokens: 200,
    temperature: 0.3,
  });

  return result.text;
}

// ── main handler ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return NextResponse.json({
      message: "skipped — GOOGLE_CALENDAR_* env vars not configured",
    });
  }

  const events = await getTodayEvents(accessToken);

  // Filter to events with external attendees (skip all-day events and internal)
  const meetingEvents = events.filter((e) => {
    if (!e.start.dateTime) return false; // skip all-day
    const external = (e.attendees ?? []).filter((a) => !a.self);
    return external.length > 0;
  });

  if (meetingEvents.length === 0) {
    return NextResponse.json({ message: "no external meetings today" });
  }

  const briefingParts: string[] = ["*📋 Pre-Meeting Briefings for Today*\n"];

  for (const event of meetingEvents) {
    const externalEmails = (event.attendees ?? [])
      .filter((a) => !a.self)
      .map((a) => a.email);

    const context = await findCrmContext(externalEmails).catch(() => null);
    const startTime = event.start.dateTime
      ? new Date(event.start.dateTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        })
      : "";

    let briefing: string;
    try {
      briefing = await generateBriefing(event, context);
    } catch {
      briefing = context
        ? "port data found but briefing generation failed."
        : "No port match found for attendees.";
    }

    briefingParts.push(`*${event.summary}* (${startTime} ET)\n${briefing}`);
  }

  briefingParts.push("\n_Full details at port.windedvertigo.com_");
  await postToSlack(briefingParts.join("\n\n"));

  return NextResponse.json({
    message: `briefings sent for ${meetingEvents.length} meetings`,
    meetings: meetingEvents.map((e) => e.summary),
  });
}
