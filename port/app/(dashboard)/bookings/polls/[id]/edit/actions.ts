"use server";

import { revalidatePath } from "next/cache";
import { updatePollDetails, deletePollOption, addPollOptions } from "@/lib/booking/mutations";

export interface UpdatePollResult {
  ok: boolean;
  error?: string;
}

export async function updatePollAction(
  pollId: string,
  input: {
    title: string;
    description?: string;
    removeOptionIds?: string[];
    addSlots?: { startsAt: string; endsAt: string }[];
  },
): Promise<UpdatePollResult> {
  try {
    await updatePollDetails(pollId, { title: input.title, description: input.description ?? null });

    if (input.removeOptionIds?.length) {
      await Promise.all(input.removeOptionIds.map((id) => deletePollOption(id)));
    }

    if (input.addSlots?.length) {
      await addPollOptions(pollId, input.addSlots);
    }

    revalidatePath(`/bookings/polls/${pollId}`);
    revalidatePath(`/bookings/polls/${pollId}/edit`);
    revalidatePath("/bookings/polls");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
