import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, createPerson, createRelationship } from "@/lib/db/queries";
import {
  isConfigured,
  getPerson,
  getPersonWithFamily,
  parseFSDate,
  type FamilySearchPerson,
} from "@/lib/familysearch/client";

async function importFSPerson(treeId: string, fsPerson: FamilySearchPerson): Promise<string> {
  // parse birth/death dates into our fuzzy date sort format
  const birthFuzzy = parseFSDate(null, fsPerson.birthDate);
  const deathFuzzy = parseFSDate(null, fsPerson.deathDate);

  const isLiving = !fsPerson.deathDate;

  const personId = await createPerson({
    treeId,
    sex: fsPerson.sex,
    isLiving,
    givenNames: fsPerson.givenName,
    surname: fsPerson.surname,
    birthDate: birthFuzzy?.date,
    deathDate: deathFuzzy?.date,
  });

  return personId;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "familysearch is not configured", configured: false },
      { status: 503 },
    );
  }

  let body: { personId?: string; includeFamily?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const { personId, includeFamily } = body;

  if (!personId || typeof personId !== "string") {
    return NextResponse.json({ error: "personId is required" }, { status: 400 });
  }

  const tree = await getOrCreateTree(session.user.email);

  try {
    const importedIds: string[] = [];

    if (includeFamily) {
      const family = await getPersonWithFamily(personId);

      // import the primary person first
      const primaryId = await importFSPerson(tree.id, family.person);
      importedIds.push(primaryId);

      // track fs id -> local id for relationships
      const idMap = new Map<string, string>();
      idMap.set(family.person.id, primaryId);

      // import parents
      for (const parent of family.parents) {
        const localId = await importFSPerson(tree.id, parent);
        importedIds.push(localId);
        idMap.set(parent.id, localId);

        await createRelationship({
          treeId: tree.id,
          person1Id: localId,
          person2Id: primaryId,
          relationshipType: "biological_parent",
        });
      }

      // import spouses
      for (const spouse of family.spouses) {
        const localId = await importFSPerson(tree.id, spouse);
        importedIds.push(localId);
        idMap.set(spouse.id, localId);

        await createRelationship({
          treeId: tree.id,
          person1Id: primaryId,
          person2Id: localId,
          relationshipType: "spouse",
        });
      }

      // import children
      for (const child of family.children) {
        const localId = await importFSPerson(tree.id, child);
        importedIds.push(localId);
        idMap.set(child.id, localId);

        await createRelationship({
          treeId: tree.id,
          person1Id: primaryId,
          person2Id: localId,
          relationshipType: "biological_parent",
        });
      }

      return NextResponse.json({
        imported: importedIds.length,
        primaryPersonId: primaryId,
        personIds: importedIds,
      });
    } else {
      // single person import
      const fsPerson = await getPerson(personId);
      const localId = await importFSPerson(tree.id, fsPerson);

      return NextResponse.json({
        imported: 1,
        primaryPersonId: localId,
        personIds: [localId],
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "import failed";
    const status = message.includes("rate limited") ? 429 : message.includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
