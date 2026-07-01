/**
 * Direct write operations the port owns:
 *   - working_hours on hosts
 *   - availability_overrides (add/delete)
 *
 * Booking creation/cancel/reschedule are NOT here — those go through the site's
 * /api/booking/* routes so we don't duplicate the slot-validation, GCal-sync,
 * and Notion-logging logic. See `cancelBooking` and `rescheduleBooking` in
 * `./site-api.ts`.
 */

import { bookingDb } from "./client";
import type { AvailabilityOverride, OverrideKind, WorkingHours, Poll, PollOption } from "./types";

export async function updateWorkingHours(
  hostId: string,
  workingHours: WorkingHours,
): Promise<void> {
  const { error } = await bookingDb
    .from("hosts")
    .update({ working_hours: workingHours })
    .eq("id", hostId);
  if (error) throw new Error(`[booking/hosts] updateWorkingHours: ${error.message}`);
}

export async function updateBuffers(
  hostId: string,
  bufferBeforeMin: number,
  bufferAfterMin: number,
): Promise<void> {
  const { error } = await bookingDb
    .from("hosts")
    .update({ buffer_before_min: bufferBeforeMin, buffer_after_min: bufferAfterMin })
    .eq("id", hostId);
  if (error) throw new Error(`[booking/hosts] updateBuffers: ${error.message}`);
}

export async function addOverride(input: {
  hostId: string;
  startIso: string;
  endIso: string;
  kind: OverrideKind;
  reason?: string;
}): Promise<AvailabilityOverride> {
  const { data, error } = await bookingDb
    .from("availability_overrides")
    .insert({
      host_id: input.hostId,
      during: `[${input.startIso},${input.endIso})`,
      kind: input.kind,
      reason: input.reason ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`[booking/overrides] addOverride: ${error.message}`);
  return data as AvailabilityOverride;
}

export async function deleteOverride(id: string): Promise<void> {
  const { error } = await bookingDb.from("availability_overrides").delete().eq("id", id);
  if (error) throw new Error(`[booking/overrides] deleteOverride: ${error.message}`);
}

// ── polls ─────────────────────────────────────────────────────────

function randomSlug(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = crypto.getRandomValues(new Uint8Array(8));
  for (const b of arr) s += chars[b % chars.length];
  return s;
}

function randomToken(): string {
  const arr = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CreatePollInput {
  title: string;
  description?: string;
  hostId?: string;
  slots: { startsAt: string; endsAt: string }[];
}

export async function createPoll(input: CreatePollInput): Promise<{ poll: Poll; options: PollOption[] }> {
  const slug = randomSlug();
  const edit_token = randomToken();

  const { data: poll, error: pErr } = await bookingDb
    .from("polls")
    .insert({
      slug,
      edit_token,
      title: input.title,
      description: input.description ?? null,
      created_by_host_id: input.hostId ?? null,
    })
    .select("*")
    .single();
  if (pErr) throw new Error(`[booking/polls] createPoll: ${pErr.message}`);

  const optionRows = input.slots.map((s, i) => ({
    poll_id: (poll as Poll).id,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
    sort_order: i,
  }));

  const { data: options, error: oErr } = await bookingDb
    .from("poll_options")
    .insert(optionRows)
    .select("*");
  if (oErr) throw new Error(`[booking/poll_options] createPoll: ${oErr.message}`);

  return { poll: poll as Poll, options: (options ?? []) as PollOption[] };
}

export async function lockPollOption(pollId: string, optionId: string): Promise<void> {
  const { error } = await bookingDb
    .from("polls")
    .update({ locked_option_id: optionId, updated_at: new Date().toISOString() })
    .eq("id", pollId);
  if (error) throw new Error(`[booking/polls] lockPollOption: ${error.message}`);
}

export async function unlockPoll(pollId: string): Promise<void> {
  const { error } = await bookingDb
    .from("polls")
    .update({ locked_option_id: null, updated_at: new Date().toISOString() })
    .eq("id", pollId);
  if (error) throw new Error(`[booking/polls] unlockPoll: ${error.message}`);
}
