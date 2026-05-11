"use server";

import { auth } from "@/lib/auth";
import { findTimes, bookTeamMeeting } from "@/lib/booking/site-internal";
import type { FindTimesResult, BookTeamMeetingResult } from "@/lib/booking/site-internal";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  return session;
}

export async function findTimesAction(input: {
  hostSlugs: string[];
  duration: number;
  fromIso: string;
  toIso: string;
  minRequired?: number;
}): Promise<{ ok: true; result: FindTimesResult } | { ok: false; error: string }> {
  await requireSession();
  try {
    const result = await findTimes(input);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function bookTeamMeetingAction(input: {
  primaryHostSlug: string;
  attendeeHostSlugs: string[];
  start: string;
  end: string;
  title: string;
  description?: string;
  timezone?: string;
}): Promise<{ ok: true; result: BookTeamMeetingResult } | { ok: false; error: string }> {
  await requireSession();
  try {
    const result = await bookTeamMeeting({ ...input, withMeet: true });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
