"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  insertBibliographyRow,
  updateBibliographyRow,
  deleteBibliographyRow,
} from "@/lib/supabase/bibliography";
import {
  parseReferences,
  planImport,
  applyImport,
  type ImportPlan,
} from "@/lib/bibliography/import";

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
    usedIn?: string[];
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

/**
 * Parse a pasted reference list + plan how it maps onto the bibliography.
 * Never writes — returns the review plan (matched / new / already-tagged).
 */
export async function parseImportAction(
  text: string,
  asset: string,
): Promise<{ plan?: ImportPlan; error?: string }> {
  await requireSession();
  try {
    if (!text?.trim()) return { error: "paste a reference list first" };
    if (!asset?.trim()) return { error: "choose or name an asset to tag" };
    const parsed = await parseReferences(text);
    if (parsed.length === 0) return { error: "no citations found in that text" };
    const plan = await planImport(parsed, asset.trim());
    return { plan };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Apply a reviewed import plan: tag matched rows + insert new citations. */
export async function applyImportAction(
  plan: ImportPlan,
): Promise<{ tagged?: number; inserted?: number; error?: string }> {
  await requireSession();
  try {
    const res = await applyImport(plan);
    revalidatePath("/bibliography");
    return res;
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
