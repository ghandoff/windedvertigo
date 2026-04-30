/**
 * Google Calendar event creation/deletion for the booking system.
 *
 * Wraps the calendar.v3.events.insert + delete endpoints, using the
 * primary calendar of the authenticated host. Auto-creates a Google
 * Meet link via conferenceData.createRequest.
 *
 * Web Crypto / fetch only — no googleapis library.
 */

import { getValidAccessTokenForHost } from "./google-oauth";

const EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface CreateEventInput {
  hostId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendees: { email: string; displayName?: string }[];
  /** Visitor's IANA timezone, used in the Google Calendar invite */
  timezone: string;
  /** Whether to add a Meet conference (default: true) */
  withMeet?: boolean;
}

export interface CreateEventResult {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
}

/**
 * Create a Google Calendar event on a host's primary calendar with the
 * given attendees. Returns the event id and Meet URL (if requested).
 */
export async function createCalendarEvent(input: CreateEventInput): Promise<CreateEventResult> {
  const accessToken = await getValidAccessTokenForHost(input.hostId);
  const requestId = crypto.randomUUID();

  const eventBody: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
    end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
    attendees: input.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName,
    })),
    reminders: { useDefault: true },
  };

  if (input.withMeet !== false) {
    eventBody.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const url = `${EVENTS_BASE}?conferenceDataVersion=1&sendUpdates=all`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`gcal events.insert failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    id: string;
    htmlLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  };

  const meetEntry = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");

  return {
    eventId: data.id,
    meetUrl: meetEntry?.uri ?? null,
    htmlLink: data.htmlLink ?? null,
  };
}

/**
 * Patch (partial-update) a Google Calendar event on a host's primary calendar.
 * Used by the reschedule flow to move an existing event to a new time without
 * deleting/recreating it (preserves the Meet link + RSVPs).
 */
export async function patchCalendarEvent(input: {
  hostId: string;
  eventId: string;
  start: Date;
  end: Date;
  timezone: string;
}): Promise<void> {
  const accessToken = await getValidAccessTokenForHost(input.hostId);
  const url = `${EVENTS_BASE}/${encodeURIComponent(input.eventId)}?sendUpdates=all`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
      end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`gcal events.patch failed (${res.status}): ${errText.slice(0, 300)}`);
  }
}

/**
 * Delete a Google Calendar event from a host's primary calendar.
 * Idempotent: a 404 or 410 (already gone) is treated as success.
 */
export async function deleteCalendarEvent(hostId: string, eventId: string): Promise<void> {
  const accessToken = await getValidAccessTokenForHost(hostId);
  const url = `${EVENTS_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.ok || res.status === 204 || res.status === 404 || res.status === 410) {
    return;
  }

  const errText = await res.text();
  throw new Error(`gcal events.delete failed (${res.status}): ${errText.slice(0, 300)}`);
}
