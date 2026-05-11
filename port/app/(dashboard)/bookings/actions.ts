"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { cancelBooking } from "@/lib/booking/site-api";
import {
  addOverride,
  deleteOverride,
  updateBuffers,
  updateWorkingHours,
} from "@/lib/booking/mutations";
import type { OverrideKind, WorkingHours } from "@/lib/booking/types";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  return session;
}

export async function cancelBookingAction(
  bookingId: string,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await cancelBooking(bookingId);
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/bookings");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateWorkingHoursAction(
  hostId: string,
  workingHours: WorkingHours,
  bufferBeforeMin: number,
  bufferAfterMin: number,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await updateWorkingHours(hostId, workingHours);
    await updateBuffers(hostId, bufferBeforeMin, bufferAfterMin);
    revalidatePath("/bookings/availability");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function addOverrideAction(input: {
  hostId: string;
  startIso: string;
  endIso: string;
  kind: OverrideKind;
  reason?: string;
}): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await addOverride(input);
    revalidatePath("/bookings/availability");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteOverrideAction(
  id: string,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await deleteOverride(id);
    revalidatePath("/bookings/availability");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
