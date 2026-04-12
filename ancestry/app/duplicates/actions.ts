"use server";

import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getTreePersons, mergePersons, getPerson, logActivity } from "@/lib/db/queries";
import { getDb } from "@/lib/db";
import { findDuplicates, type DuplicateMatch } from "@/lib/duplicates/detector";
import { revalidatePath } from "next/cache";
import type { Person } from "@/lib/types";

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

// ---------------------------------------------------------------------------
// merge wizard actions
// ---------------------------------------------------------------------------

export type MergeSelections = {
  keepNames: string[];
  keepEvents: string[];
  sex: string;
  isLiving: boolean;
  thumbnailUrl: string | null;
  notes: string | null;
};

export async function getPersonForMergeAction(personId: string): Promise<Person> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const person = await getPerson(personId);
  if (!person || person.tree_id !== tree.id) throw new Error("person not found");
  return person;
}

export async function mergeWithSelectionsAction(
  keepId: string,
  removeId: string,
  selections: MergeSelections,
): Promise<void> {
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

  const sql = getDb();

  // 1. update the kept person's scalar fields
  await sql`
    UPDATE persons SET
      sex = ${selections.sex},
      is_living = ${selections.isLiving},
      thumbnail_url = ${selections.thumbnailUrl},
      notes = ${selections.notes},
      updated_at = NOW()
    WHERE id = ${keepId}
  `;

  // 2. move selected names from the removed person to the kept person
  const keepNameSet = new Set(selections.keepNames);
  const removePersonNames = removePerson.names;
  for (const n of removePersonNames) {
    if (keepNameSet.has(n.id)) {
      await sql`UPDATE person_names SET person_id = ${keepId}, is_primary = false WHERE id = ${n.id}`;
    }
  }
  // delete unselected names from the kept person
  const keepPersonNames = keepPerson.names;
  for (const n of keepPersonNames) {
    if (!keepNameSet.has(n.id)) {
      await sql`DELETE FROM person_names WHERE id = ${n.id}`;
    }
  }

  // 3. move selected events from the removed person to the kept person
  const keepEventSet = new Set(selections.keepEvents);
  const removePersonEvents = removePerson.events;
  for (const e of removePersonEvents) {
    if (keepEventSet.has(e.id)) {
      await sql`UPDATE events SET person_id = ${keepId} WHERE id = ${e.id}`;
    }
  }
  // delete unselected events from the kept person
  const keepPersonEvents = keepPerson.events;
  for (const e of keepPersonEvents) {
    if (!keepEventSet.has(e.id)) {
      await sql`DELETE FROM events WHERE id = ${e.id}`;
    }
  }

  // 4. move relationships from removed person to kept person (skip duplicates)
  const existingRels = await sql`
    SELECT person1_id, person2_id, relationship_type FROM relationships
    WHERE person1_id = ${keepId} OR person2_id = ${keepId}
  `;
  const relSet = new Set(existingRels.map((r) =>
    `${r.person1_id}|${r.person2_id}|${r.relationship_type}`
  ));

  const rels1 = await sql`
    SELECT id, person1_id, person2_id, relationship_type FROM relationships
    WHERE person1_id = ${removeId}
  `;
  for (const r of rels1) {
    if (r.person2_id === keepId) {
      await sql`DELETE FROM relationships WHERE id = ${r.id}`;
    } else {
      const key = `${keepId}|${r.person2_id}|${r.relationship_type}`;
      if (!relSet.has(key)) {
        await sql`UPDATE relationships SET person1_id = ${keepId} WHERE id = ${r.id}`;
        relSet.add(key);
      } else {
        await sql`DELETE FROM relationships WHERE id = ${r.id}`;
      }
    }
  }

  const rels2 = await sql`
    SELECT id, person1_id, person2_id, relationship_type FROM relationships
    WHERE person2_id = ${removeId}
  `;
  for (const r of rels2) {
    if (r.person1_id === keepId) {
      await sql`DELETE FROM relationships WHERE id = ${r.id}`;
    } else {
      const key = `${r.person1_id}|${keepId}|${r.relationship_type}`;
      if (!relSet.has(key)) {
        await sql`UPDATE relationships SET person2_id = ${keepId} WHERE id = ${r.id}`;
        relSet.add(key);
      } else {
        await sql`DELETE FROM relationships WHERE id = ${r.id}`;
      }
    }
  }

  // 5. move media links and hints
  await sql`UPDATE media_links SET person_id = ${keepId} WHERE person_id = ${removeId}`;
  try {
    await sql`UPDATE hints SET person_id = ${keepId} WHERE person_id = ${removeId}`;
  } catch { /* hints table may not exist */ }

  // 6. delete the removed person (cascades remaining names, events via FK)
  await sql`DELETE FROM persons WHERE id = ${removeId}`;

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
