"use server";

import { revalidatePath } from "next/cache";
import { lockPollOption, unlockPoll } from "@/lib/booking/mutations";

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
