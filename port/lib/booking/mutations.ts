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
import type { AvailabilityOverride, OverrideKind, WorkingHours } from "./types";

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
