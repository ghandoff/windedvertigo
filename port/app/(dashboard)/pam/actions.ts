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
  due_date?: string;
  source?: string;
}): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await insertPamCommitment({
      who: input.who,
      what: input.what,
      due_date: input.due_date || undefined,
      source: input.source || "port",
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
