"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { lockPollOption, unlockPoll, addPollOptions, deletePoll } from "@/lib/booking/mutations";

export async function lockOptionAction(pollId: string, optionId: string) {
  await lockPollOption(pollId, optionId);
  revalidatePath(`/bookings/polls/${pollId}`);
  revalidatePath("/bookings");
}

export async function unlockPollAction(pollId: string) {
  await unlockPoll(pollId);
  revalidatePath(`/bookings/polls/${pollId}`);
  revalidatePath("/bookings");
}

export async function addPollOptionsAction(pollId: string, formData: FormData) {
  const startsArr = formData.getAll("starts_at") as string[];
  const endsArr = formData.getAll("ends_at") as string[];
  const toIso = (local: string) => (local ? new Date(local).toISOString() : "");
  const slots = startsArr
    .map((s, i) => ({ startsAt: toIso(s), endsAt: toIso(endsArr[i] ?? s) }))
    .filter((sl) => sl.startsAt && sl.endsAt && sl.startsAt !== sl.endsAt);

  if (slots.length > 0) {
    await addPollOptions(pollId, slots);
    revalidatePath(`/bookings/polls/${pollId}`);
  }
}

export async function deletePollAction(pollId: string) {
  await deletePoll(pollId);
  revalidatePath("/bookings");
  redirect("/bookings");
}
