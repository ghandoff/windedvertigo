"use server";

import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getTreePersons, createPerson, createRelationship, logActivity, getPerson } from "@/lib/db/queries";
import { generateHintsForPerson } from "@/lib/hints/engine";
import { revalidatePath } from "next/cache";

/** fire-and-forget hint generation for a newly created person */
async function autoHint(treeId: string, personId: string) {
  try {
    const [person, allPersons] = await Promise.all([
      getPerson(personId),
      getTreePersons(treeId),
    ]);
    if (person) {
      await generateHintsForPerson(treeId, person, allPersons);
    }
  } catch {
    // non-critical — don't block person creation
  }
}

export async function addPerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);

  const givenNames = formData.get("givenNames") as string;
  const surname = formData.get("surname") as string;
  const middleName = (formData.get("middleName") as string)?.trim() || undefined;
  const maidenName = (formData.get("maidenName") as string)?.trim() || undefined;
  const birthPlace = (formData.get("birthPlace") as string)?.trim() || undefined;
  const currentResidence = (formData.get("currentResidence") as string)?.trim() || undefined;

  const personId = await createPerson({
    treeId: tree.id,
    givenNames,
    surname,
    middleName,
    maidenName,
    sex: (formData.get("sex") as string) || "U",
    isLiving: formData.get("isLiving") !== "false",
    birthDate: (formData.get("birthDate") as string) || undefined,
    birthPlace,
    deathDate: (formData.get("deathDate") as string) || undefined,
    currentResidence,
  });

  const displayName = [givenNames, middleName, surname].filter(Boolean).join(" ");
  await logActivity({
    treeId: tree.id,
    actorEmail: session.user.email,
    action: "person_added",
    targetType: "person",
    targetId: personId,
    targetName: displayName,
  });

  // fire-and-forget hint generation
  autoHint(tree.id, personId);

  revalidatePath("/");
}

export async function addRelationship(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);

  const relationshipType = formData.get("relationshipType") as string;

  const relId = await createRelationship({
    treeId: tree.id,
    person1Id: formData.get("person1Id") as string,
    person2Id: formData.get("person2Id") as string,
    relationshipType,
  });

  if (relId) {
    await logActivity({
      treeId: tree.id,
      actorEmail: session.user.email,
      action: "relationship_added",
      targetType: "relationship",
      targetId: relId,
      details: { relationship_type: relationshipType },
    });
  }

  revalidatePath("/");
}

/** onboarding wizard — creates self, parents, grandparents + relationships in one go */
export async function setupTreeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const treeId = tree.id;
  const email = session.user.email;

  // helper to parse a person from form data by prefix
  function parsePerson(prefix: string) {
    const givenNames = (formData.get(`${prefix}_givenNames`) as string)?.trim();
    const surname = (formData.get(`${prefix}_surname`) as string)?.trim();
    if (!givenNames && !surname) return null;
    return {
      givenNames: givenNames || "unknown",
      surname: surname || "unknown",
      middleName: (formData.get(`${prefix}_middleName`) as string)?.trim() || undefined,
      maidenName: (formData.get(`${prefix}_maidenName`) as string)?.trim() || undefined,
      sex: (formData.get(`${prefix}_sex`) as string) || "U",
      birthDate: (formData.get(`${prefix}_birthDate`) as string) || undefined,
      birthPlace: (formData.get(`${prefix}_birthPlace`) as string)?.trim() || undefined,
    };
  }

  // create a person and log it
  async function create(data: {
    givenNames: string; surname: string; sex: string;
    middleName?: string; maidenName?: string; birthDate?: string; birthPlace?: string;
  }) {
    const personId = await createPerson({
      treeId,
      givenNames: data.givenNames,
      surname: data.surname,
      middleName: data.middleName,
      maidenName: data.maidenName,
      sex: data.sex,
      isLiving: true,
      birthDate: data.birthDate,
      birthPlace: data.birthPlace,
    });
    const displayName = [data.givenNames, data.middleName, data.surname].filter(Boolean).join(" ");
    await logActivity({
      treeId,
      actorEmail: email,
      action: "person_added",
      targetType: "person",
      targetId: personId,
      targetName: displayName,
    });
    return personId;
  }

  // link parent -> child
  async function linkParent(parentId: string, childId: string) {
    const relId = await createRelationship({
      treeId,
      person1Id: parentId,
      person2Id: childId,
      relationshipType: "biological_parent",
    });
    if (relId) {
      await logActivity({
        treeId,
        actorEmail: email,
        action: "relationship_added",
        targetType: "relationship",
        targetId: relId,
        details: { relationship_type: "biological_parent" },
      });
    }
  }

  // link spouses
  async function linkSpouse(p1: string, p2: string) {
    const relId = await createRelationship({
      treeId,
      person1Id: p1,
      person2Id: p2,
      relationshipType: "spouse",
    });
    if (relId) {
      await logActivity({
        treeId,
        actorEmail: email,
        action: "relationship_added",
        targetType: "relationship",
        targetId: relId,
        details: { relationship_type: "spouse" },
      });
    }
  }

  // step 1: self
  const selfData = parsePerson("self");
  if (!selfData) return { success: false, error: "please enter your name" };
  const selfId = await create(selfData);

  // step 2: parents
  const fatherData = parsePerson("father");
  const motherData = parsePerson("mother");
  const fatherId = fatherData ? await create(fatherData) : null;
  const motherId = motherData ? await create(motherData) : null;

  if (fatherId) await linkParent(fatherId, selfId);
  if (motherId) await linkParent(motherId, selfId);
  if (fatherId && motherId) await linkSpouse(fatherId, motherId);

  // step 3: grandparents
  const pgfData = parsePerson("pgf");
  const pgmData = parsePerson("pgm");
  const mgfData = parsePerson("mgf");
  const mgmData = parsePerson("mgm");

  const pgfId = (pgfData && fatherId) ? await create(pgfData) : null;
  const pgmId = (pgmData && fatherId) ? await create(pgmData) : null;
  const mgfId = (mgfData && motherId) ? await create(mgfData) : null;
  const mgmId = (mgmData && motherId) ? await create(mgmData) : null;

  if (pgfId && fatherId) await linkParent(pgfId, fatherId);
  if (pgmId && fatherId) await linkParent(pgmId, fatherId);
  if (pgfId && pgmId) await linkSpouse(pgfId, pgmId);

  if (mgfId && motherId) await linkParent(mgfId, motherId);
  if (mgmId && motherId) await linkParent(mgmId, motherId);
  if (mgfId && mgmId) await linkSpouse(mgfId, mgmId);

  revalidatePath("/");
  return { success: true };
}

/** quick-add a relative from a person node — creates person + relationship */
export async function quickAddRelativeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const treeId = tree.id;
  const email = session.user.email;

  const relatedPersonId = formData.get("relatedPersonId") as string;
  const relationship = formData.get("relationship") as string; // parent, child, spouse
  const givenNames = (formData.get("givenNames") as string).trim();
  const surname = (formData.get("surname") as string).trim();
  const middleName = (formData.get("middleName") as string)?.trim() || undefined;
  const maidenName = (formData.get("maidenName") as string)?.trim() || undefined;
  const sex = (formData.get("sex") as string) || "U";
  const birthYear = (formData.get("birthYear") as string)?.trim();
  const birthPlace = (formData.get("birthPlace") as string)?.trim() || undefined;

  // create the person
  const birthDate = birthYear ? `${birthYear}-01-01` : undefined;
  const personId = await createPerson({
    treeId,
    givenNames,
    surname,
    middleName,
    maidenName,
    sex,
    isLiving: true,
    birthDate,
    birthPlace,
  });

  const displayName = [givenNames, middleName, surname].filter(Boolean).join(" ");
  await logActivity({
    treeId,
    actorEmail: email,
    action: "person_added",
    targetType: "person",
    targetId: personId,
    targetName: displayName,
  });

  // create the relationship
  let relType: string;
  let person1Id: string;
  let person2Id: string;

  switch (relationship) {
    case "parent":
      // new person is parent of the related person
      relType = "biological_parent";
      person1Id = personId;
      person2Id = relatedPersonId;
      break;
    case "child":
      // related person is parent of new person
      relType = "biological_parent";
      person1Id = relatedPersonId;
      person2Id = personId;
      break;
    case "spouse":
      relType = "spouse";
      person1Id = relatedPersonId;
      person2Id = personId;
      break;
    default:
      throw new Error(`unknown relationship type: ${relationship}`);
  }

  const relId = await createRelationship({
    treeId,
    person1Id,
    person2Id,
    relationshipType: relType,
  });

  if (relId) {
    await logActivity({
      treeId,
      actorEmail: email,
      action: "relationship_added",
      targetType: "relationship",
      targetId: relId,
      details: { relationship_type: relType },
    });
  }

  // fire-and-forget hint generation for the new person
  autoHint(treeId, personId);

  revalidatePath("/");
}
