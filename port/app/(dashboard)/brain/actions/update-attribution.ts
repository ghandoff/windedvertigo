"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { deleteEdgesFromNode, patchNodeAttrs } from "@/lib/knowledge/supabase";

export async function updateAttribution(
  nodeId: string,
  newCvEntryId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Remove all existing fed-into edges from this deliverable (notion-cv or adjudicator)
    await deleteEdgesFromNode(nodeId, "fed-into");

    // 2. Insert the corrected fed-into edge with source: "adjudicator"
    //    The unique constraint is (source_id, target_id, relationship, source) so this won't
    //    collide with the old notion-cv edge (already deleted) or any future sync edge.
    const now = new Date().toISOString();
    const { error: insertErr } = await supabase.from("knowledge_edges").insert({
      source_id: nodeId,
      target_id: newCvEntryId,
      relationship: "fed-into",
      source: "adjudicator",
      attrs: {},
      last_seen_at: now,
      updated_at: now,
    });
    if (insertErr) throw new Error(insertErr.message);

    // 3. Patch the node attrs to record the correction
    await patchNodeAttrs(nodeId, {
      appliedInEntry: newCvEntryId,
      adjudicatorEditedAt: now,
    });

    revalidatePath("/brain");
    return { ok: true };
  } catch (err) {
    console.error("[update-attribution]", err);
    return { ok: false, error: (err as Error).message };
  }
}
