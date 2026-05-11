/**
 * Calls into the site's internal booking endpoints. Used by the find-a-time
 * panel to source freebusy + create team-meeting GCal events without
 * duplicating the OAuth/encryption/token-refresh logic that lives on the
 * site.
 */

const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://windedvertigo.com";

function getInternalToken(): string {
  const t = process.env.BOOKING_INTERNAL_TOKEN;
  if (!t) {
    throw new Error("BOOKING_INTERNAL_TOKEN missing on port worker");
  }
  return t;
}

export interface FindWindow {
  start: string; // ISO
  end: string; // ISO
  freeHostIds: string[];
}

export interface FindHost {
  id: string;
  slug: string;
  display_name: string;
}

export interface FindTimesResult {
  windows: FindWindow[];
  hosts: FindHost[];
}

export async function findTimes(input: {
  hostSlugs: string[];
  duration: number;
  fromIso: string;
  toIso: string;
  minRequired?: number;
}): Promise<FindTimesResult> {
  const res = await fetch(`${SITE_ORIGIN}/api/booking/internal/find-times`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getInternalToken()}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`find-times failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as FindTimesResult;
}

export interface BookTeamMeetingResult {
  eventId: string;
  htmlLink: string | null;
  meetUrl: string | null;
  primaryHost: { slug: string; display_name: string };
  attendees: { slug: string; display_name: string }[];
}

export async function bookTeamMeeting(input: {
  primaryHostSlug: string;
  attendeeHostSlugs: string[];
  start: string;
  end: string;
  title: string;
  description?: string;
  timezone?: string;
  withMeet?: boolean;
}): Promise<BookTeamMeetingResult> {
  const res = await fetch(`${SITE_ORIGIN}/api/booking/internal/book-team-meeting`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getInternalToken()}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`book-team-meeting failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as BookTeamMeetingResult;
}
