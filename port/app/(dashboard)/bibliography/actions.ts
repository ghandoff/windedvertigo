"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  insertBibliographyRow,
  updateBibliographyRow,
  deleteBibliographyRow,
} from "@/lib/supabase/bibliography";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  return session;
}

export async function addCitationAction(input: {
  fullCitation: string;
  topic?: string;
  sourceType?: string;
  year?: number | null;
  doi?: string;
  abstract?: string;
  notes?: string;
  usedIn?: string[];
}): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    if (!input.fullCitation?.trim()) return { error: "a full citation is required" };
    const res = await insertBibliographyRow({
      fullCitation: input.fullCitation.trim(),
      topic: input.topic?.trim() || undefined,
      sourceType: input.sourceType?.trim() || undefined,
      year: input.year ?? null,
      doi: input.doi?.trim() || null,
      abstract: input.abstract?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      usedIn: input.usedIn ?? [],
    });
    if (!res.created) return { error: res.reason === "duplicate" ? "that citation is already in the bibliography" : "couldn't add it" };
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Set the full used_in (assets) list for an entry. */
export async function updateUsedInAction(
  id: string,
  usedIn: string[],
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await updateBibliographyRow(id, { usedIn });
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateCitationAction(
  id: string,
  fields: {
    fullCitation?: string;
    topic?: string | null;
    sourceType?: string | null;
    year?: number | null;
    doi?: string | null;
    abstract?: string | null;
    notes?: string | null;
  },
): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await updateBibliographyRow(id, fields);
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCitationAction(id: string): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await deleteBibliographyRow(id);
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
