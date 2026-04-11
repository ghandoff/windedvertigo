"use server";

import { auth } from "@windedvertigo/auth";
import {
  getPerson,
  getOrCreateTree,
  updatePerson as dbUpdatePerson,
  addEvent as dbAddEvent,
  deleteEvent as dbDeleteEvent,
  deletePerson as dbDeletePerson,
  deleteRelationship as dbDeleteRelationship,
  createSource,
  createCitation,
  deleteCitation as dbDeleteCitation,
  logActivity,
} from "@/lib/db/queries";
import { revalidatePath } from "next/cache";

async function verifyOwnership(personId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const person = await getPerson(personId);
  if (!person || person.tree_id !== tree.id) throw new Error("not found");

  return { session, tree, person };
}

export async function updatePersonAction(personId: string, formData: FormData) {
  const { session, tree, person } = await verifyOwnership(personId);

  await dbUpdatePerson(personId, {
    givenNames: (formData.get("givenNames") as string) || undefined,
    surname: (formData.get("surname") as string) || undefined,
    sex: (formData.get("sex") as string) || undefined,
    isLiving: formData.get("isLiving") === "true",
  });

  const primaryName = person.names.find((n) => n.is_primary) ?? person.names[0];
  const displayName = primaryName?.display ?? "unnamed";
  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "person_updated",
    targetType: "person",
    targetId: personId,
    targetName: displayName,
  });

  revalidatePath(`/person/${personId}`);
  revalidatePath("/");
}

export async function updateBiographyAction(personId: string, formData: FormData) {
  await verifyOwnership(personId);

  await dbUpdatePerson(personId, {
    notes: (formData.get("notes") as string) ?? "",
  });

  revalidatePath(`/person/${personId}`);
}

export async function addEventAction(personId: string, formData: FormData) {
  await verifyOwnership(personId);

  await dbAddEvent(personId, {
    eventType: formData.get("eventType") as string,
    date: (formData.get("date") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  });

  revalidatePath(`/person/${personId}`);
  revalidatePath("/");
}

export async function deleteEventAction(eventId: string, personId: string) {
  await verifyOwnership(personId);

  await dbDeleteEvent(eventId);

  revalidatePath(`/person/${personId}`);
  revalidatePath("/");
}

export async function addSourceAction(personId: string, formData: FormData) {
  const { session, tree } = await verifyOwnership(personId);

  const title = formData.get("title") as string;
  if (!title?.trim()) throw new Error("title is required");

  const sourceId = await createSource(tree.id, {
    title: title.trim(),
    author: (formData.get("author") as string) || null,
    publisher: (formData.get("publisher") as string) || null,
    sourceType: (formData.get("sourceType") as string) || null,
    url: (formData.get("url") as string) || null,
    notes: (formData.get("sourceNotes") as string) || null,
  });

  const eventId = formData.get("eventId") as string;
  if (eventId && sourceId) {
    await createCitation({
      sourceId,
      eventId,
      page: (formData.get("page") as string) || null,
      confidence: (formData.get("confidence") as string) || null,
      extract: (formData.get("extract") as string) || null,
      notes: (formData.get("citationNotes") as string) || null,
    });
  }

  if (sourceId) {
    await logActivity({
      treeId: tree.id,
      actorEmail: session.user!.email!,
      action: "source_added",
      targetType: "source",
      targetId: sourceId,
      targetName: title.trim(),
    });
  }

  revalidatePath(`/person/${personId}`);
  revalidatePath("/sources");
}

export async function deleteCitationAction(citationId: string, personId: string) {
  await verifyOwnership(personId);

  await dbDeleteCitation(citationId);

  revalidatePath(`/person/${personId}`);
  revalidatePath("/sources");
}

export async function deletePersonAction(personId: string) {
  const { session, tree, person } = await verifyOwnership(personId);

  const primaryName = person.names.find((n) => n.is_primary) ?? person.names[0];
  const displayName = primaryName?.display ??
    [primaryName?.given_names, primaryName?.surname].filter(Boolean).join(" ") ?? "unnamed";

  await dbDeletePerson(personId);

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "person_deleted",
    targetType: "person",
    targetId: personId,
    targetName: displayName,
  });

  revalidatePath("/");
}

export async function deleteRelationshipAction(relationshipId: string, personId: string) {
  const { session, tree } = await verifyOwnership(personId);

  await dbDeleteRelationship(relationshipId);

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "relationship_deleted",
    targetType: "relationship",
    targetId: relationshipId,
  });

  revalidatePath(`/person/${personId}`);
  revalidatePath("/");
}
