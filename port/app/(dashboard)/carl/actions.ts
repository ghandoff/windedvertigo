"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { insertCarlFinding } from "@/lib/supabase/carl";
import { insertCarlCurriculumTopic } from "@/lib/supabase/carl-curriculum";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  return session;
}

/**
 * Assign cARL a research topic to cover. Creates a `carl_curriculum` row
 * (status: planned) that cARL's study cron picks up; cited sources cARL files
 * land back in the bibliography. This is the Pam/Mo → cARL handoff surface —
 * the same action backs the affordance on /bibliography, /carl, and the agent
 * dashboards.
 */
export async function assignResearchTopicAction(input: {
  domain: string;
  topic: string;
  keyWorks?: string[];
  priority?: number;
  notes?: string;
  /** who assigned it — surfaced in the curriculum note for transparency. */
  assignedBy?: string;
}): Promise<{ ok?: true; error?: string }> {
  await requireSession();
  try {
    if (!input.domain?.trim()) return { error: "a research domain is required" };
    if (!input.topic?.trim()) return { error: "a topic is required" };
    const note = [input.notes?.trim(), input.assignedBy ? `assigned by ${input.assignedBy.trim()}` : null]
      .filter(Boolean)
      .join(" · ");
    await insertCarlCurriculumTopic({
      domain: input.domain.trim(),
      topic: input.topic.trim(),
      key_works: (input.keyWorks ?? []).map((w) => w.trim()).filter(Boolean),
      priority: input.priority ?? 2,
      notes: note || undefined,
    });
    revalidatePath("/carl");
    revalidatePath("/bibliography");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
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
