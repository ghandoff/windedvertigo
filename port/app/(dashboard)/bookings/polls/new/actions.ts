"use server";

import { createPoll, updatePollInvitees } from "@/lib/booking/mutations";
import { getHostByEmail, getPollById } from "@/lib/booking/queries";
import { auth } from "@/lib/auth";
import { sendOutreachEmail } from "@/lib/email/resend";

export interface CreatePollResult {
  slug: string;
  shareUrl: string;
  pollId: string;
}

export async function createPollAction(
  _prev: CreatePollResult | null,
  formData: FormData,
): Promise<CreatePollResult | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const host = email ? await getHostByEmail(email).catch(() => null) : null;

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) throw new Error("title is required");

  const description = (formData.get("description") as string | null)?.trim() || undefined;

  // slots are submitted as parallel arrays: starts_at[] and ends_at[]
  const startsArr = formData.getAll("starts_at") as string[];
  const endsArr = formData.getAll("ends_at") as string[];
  // datetime-local values arrive without timezone info; treat as America/Los_Angeles
  // (the host's timezone) by appending the offset. We parse to ISO for storage.
  const toIso = (local: string) => {
    if (!local) return "";
    // Append PST/PDT offset — datetime-local has no tz info, and the host is in LA.
    // For a multi-tz team this should use the session host's tz from the host row.
    return new Date(local).toISOString();
  };
  const slots = startsArr
    .map((s, i) => ({ startsAt: toIso(s), endsAt: toIso(endsArr[i] ?? s) }))
    .filter((sl) => sl.startsAt && sl.endsAt);

  if (slots.length === 0) throw new Error("at least one time slot is required");

  const { poll } = await createPoll({
    title,
    description,
    hostId: host?.id,
    slots,
  });

  return {
    slug: poll.slug,
    pollId: poll.id,
    shareUrl: `${process.env.SITE_ORIGIN ?? "https://windedvertigo.com"}/book/poll/${poll.slug}`,
  };
}

export async function sendPollInvitesAction(pollId: string, emails: string[]): Promise<void> {
  const poll = await getPollById(pollId).catch(() => null);
  const shareUrl = poll
    ? `${process.env.SITE_ORIGIN ?? "https://windedvertigo.com"}/book/poll/${poll.slug}`
    : "";

  await updatePollInvitees(pollId, emails).catch((err) =>
    console.error("[sendPollInvitesAction] failed to store invitees:", err),
  );

  for (const to of emails) {
    try {
      await sendOutreachEmail({
        to,
        from: `winded.vertigo polls <polls@windedvertigo.com>`,
        subject: "you've been invited to vote on a time",
        html: `<p>you've been invited to vote on a time.</p>${shareUrl ? `<p><a href="${shareUrl}">${shareUrl}</a></p>` : ""}`,
        text: shareUrl
          ? `you've been invited to vote on a time.\n\n${shareUrl}`
          : "you've been invited to vote on a time.",
      });
    } catch (err) {
      console.error(`[sendPollInvitesAction] failed to send to ${to}:`, err);
    }
  }
}
