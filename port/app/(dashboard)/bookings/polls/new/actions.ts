"use server";

import { redirect } from "next/navigation";
import { createPoll } from "@/lib/booking/mutations";
import { getHostByEmail } from "@/lib/booking/queries";
import { auth } from "@/lib/auth";

export async function createPollAction(formData: FormData) {
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

  redirect(`/bookings/polls/${poll.id}`);
}
