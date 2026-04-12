"use server";

import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getPerson, updateDnaData, logActivity } from "@/lib/db/queries";
import type { DnaData } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function saveDnaDataAction(personId: string, data: DnaData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const person = await getPerson(personId);
  if (!person || person.tree_id !== tree.id) throw new Error("person not found");

  await updateDnaData(personId, data);

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user.email!,
    action: "dna_updated",
    targetType: "person",
    targetId: personId,
    targetName: `${data.ethnicity.length} regions`,
  });

  revalidatePath(`/person/${personId}`);
}
