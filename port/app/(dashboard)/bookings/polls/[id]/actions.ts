"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { lockPollOption, unlockPoll, addPollOptions, deletePoll } from "@/lib/booking/mutations";
import { getPollById } from "@/lib/booking/queries";
import { sendOutreachEmail } from "@/lib/email/resend";

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

export async function sendPollReminderAction(pollId: string, emails: string[]): Promise<void> {
  const poll = await getPollById(pollId).catch(() => null);
  if (!poll) return;
  const shareUrl = `${process.env.SITE_ORIGIN ?? "https://windedvertigo.com"}/book/poll/${poll.slug}`;

  for (const to of emails) {
    try {
      await sendOutreachEmail({
        to,
        from: `winded.vertigo polls <polls@windedvertigo.com>`,
        subject: `reminder: vote on "${poll.title}"`,
        html: `<p>a friendly reminder — your vote is still needed for <strong>${poll.title}</strong>.</p><p><a href="${shareUrl}">cast your vote here</a></p>`,
        text: `a friendly reminder — your vote is still needed for "${poll.title}".\n\n${shareUrl}`,
      });
    } catch (err) {
      console.error(`[sendPollReminderAction] failed to send to ${to}:`, err);
    }
  }
}
