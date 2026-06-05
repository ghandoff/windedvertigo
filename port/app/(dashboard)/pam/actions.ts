"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { insertPamCommitment, updatePamCommitment } from "@/lib/supabase/pam";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  return session;
}

export async function updateCommitmentStatusAction(
  id: string,
  status: string,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    const completed_at = status === "done" ? new Date().toISOString() : undefined;
    await updatePamCommitment(id, { status, completed_at });
    revalidatePath("/pam");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function addCommitmentAction(input: {
  who: string;
  what: string;
  start_date?: string;
  due_date?: string;
  source?: string;
}): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await insertPamCommitment({
      who: input.who,
      what: input.what,
      start_date: input.start_date || undefined,
      due_date: input.due_date || undefined,
      source: input.source || "port",
    });
    revalidatePath("/pam");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Move/resize a commitment's bar on the timeline. */
export async function rescheduleCommitmentAction(
  id: string,
  start_date: string,
  due_date: string,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await updatePamCommitment(id, { start_date, due_date });
    revalidatePath("/pam");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Edit an existing commitment from the timeline detail dialog. */
export async function updateCommitmentAction(
  id: string,
  fields: {
    what?: string;
    status?: string;
    start_date?: string;
    due_date?: string;
  },
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await updatePamCommitment(id, {
      ...fields,
      ...(fields.status === "done" ? { completed_at: new Date().toISOString() } : {}),
    });
    revalidatePath("/pam");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setBlockerAction(
  id: string,
  blocker: string,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await updatePamCommitment(id, { status: "blocked", blocker });
    revalidatePath("/pam");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
