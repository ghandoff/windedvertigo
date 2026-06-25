"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  insertPamCommitment,
  updatePamCommitment,
  deletePamCommitment,
  getPamCommitments,
} from "@/lib/supabase/pam";
import { wouldCreateCycle } from "@/app/components/timeline/graph";
import { getWorkItemsFromSupabase } from "@/lib/supabase/work-items";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  return session;
}

/**
 * Search non-archived Notion work_items by title — for linking a commitment to
 * its "shipped work" counterpart in the edit dialog. Returns up to 20 matches.
 */
export async function searchWorkItemsAction(
  query: string,
): Promise<Array<{ id: string; task: string }>> {
  await requireSession();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  try {
    const items = await getWorkItemsFromSupabase(undefined, undefined, undefined, false);
    return items
      .filter((w) => w.task?.toLowerCase().includes(q))
      .slice(0, 20)
      .map((w) => ({ id: w.id, task: w.task }));
  } catch {
    return [];
  }
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
    who?: string;
    what?: string;
    status?: string;
    start_date?: string;
    due_date?: string;
    work_item_id?: string | null;
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

export async function deleteCommitmentAction(
  id: string,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await deletePamCommitment(id);
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

/** Add a finish-to-start dependency: successor depends on predecessor. Guards against cycles + dupes. */
export async function addDependencyAction(
  successorId: string,
  predecessorId: string,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  if (successorId === predecessorId) return { error: "a commitment can't depend on itself" };
  try {
    const all = await getPamCommitments({ limit: 500 });
    const succ = all.find((c) => c.id === successorId);
    if (!succ) return { error: "commitment not found" };

    const current = succ.depends_on ?? [];
    if (current.includes(predecessorId)) return { error: "dependency already exists" };

    const nodes = all.map((c) => ({ id: c.id, dependsOn: c.depends_on ?? [] }));
    if (wouldCreateCycle(nodes, predecessorId, successorId)) {
      return { error: "that link would create a cycle" };
    }

    await updatePamCommitment(successorId, { depends_on: [...current, predecessorId] });
    revalidatePath("/pam");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Remove a dependency link. */
export async function removeDependencyAction(
  successorId: string,
  predecessorId: string,
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    const all = await getPamCommitments({ limit: 500 });
    const succ = all.find((c) => c.id === successorId);
    if (!succ) return { error: "commitment not found" };
    const next = (succ.depends_on ?? []).filter((id) => id !== predecessorId);
    await updatePamCommitment(successorId, { depends_on: next });
    revalidatePath("/pam");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Batch-apply a cascade of date shifts (critical-path auto-shift). */
export async function cascadeRescheduleAction(
  updates: { id: string; start: string; end: string }[],
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    for (const u of updates) {
      await updatePamCommitment(u.id, { start_date: u.start, due_date: u.end });
    }
    revalidatePath("/pam");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
