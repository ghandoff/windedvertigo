"use server";

import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getTreePersons, mergePersons, getPerson, logActivity } from "@/lib/db/queries";
import { findDuplicates, type DuplicateMatch } from "@/lib/duplicates/detector";
import { revalidatePath } from "next/cache";

export type SerializedDuplicate = {
  personAId: string;
  personAName: string;
  personBId: string;
  personBName: string;
  score: number;
  reasons: string[];
};

function getDisplayName(person: { names: { is_primary: boolean; display: string | null; given_names: string | null; surname: string | null }[] }): string {
  const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
  return primary?.display ?? [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ?? "unnamed";
}

export async function scanDuplicatesAction(): Promise<SerializedDuplicate[]> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const persons = await getTreePersons(tree.id);
  const matches = findDuplicates(persons);

  return matches.map((m) => ({
    personAId: m.personA.id,
    personAName: getDisplayName(m.personA),
    personBId: m.personB.id,
    personBName: getDisplayName(m.personB),
    score: m.score,
    reasons: m.reasons,
  }));
}

export async function mergePersonsAction(keepId: string, removeId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);

  // verify both persons belong to this tree
  const keepPerson = await getPerson(keepId);
  const removePerson = await getPerson(removeId);
  if (!keepPerson || keepPerson.tree_id !== tree.id) throw new Error("person not found");
  if (!removePerson || removePerson.tree_id !== tree.id) throw new Error("person not found");

  const keepName = getDisplayName(keepPerson);
  const removeName = getDisplayName(removePerson);

  await mergePersons(keepId, removeId);

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user.email!,
    action: "person_merged",
    targetType: "person",
    targetId: keepId,
    targetName: `${removeName} → ${keepName}`,
  });

  revalidatePath("/");
  revalidatePath(`/person/${keepId}`);
  revalidatePath("/duplicates");
}
