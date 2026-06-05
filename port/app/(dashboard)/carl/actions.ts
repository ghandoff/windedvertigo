"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { insertCarlFinding } from "@/lib/supabase/carl";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  return session;
}

export async function addFindingAction(input: {
  domain: string;
  title: string;
  summary: string;
  source?: string;
  citation?: string;
  relevance?: string;
  tags?: string[];
}): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    await insertCarlFinding({
      domain: input.domain.trim(),
      title: input.title.trim(),
      summary: input.summary.trim(),
      source: input.source?.trim() || undefined,
      citation: input.citation?.trim() || undefined,
      relevance: input.relevance?.trim() || undefined,
      tags: input.tags ?? [],
    });
    revalidatePath("/carl");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
