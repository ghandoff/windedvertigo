import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getTreePersons, getPerson } from "@/lib/db/queries";
import { generateHintsForPerson, generateHintsForTree } from "@/lib/hints/engine";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  if (!tree) {
    return NextResponse.json({ error: "no tree found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const personId = body.personId as string | undefined;

  const persons = await getTreePersons(tree.id);

  if (personId) {
    // generate hints for a single person
    const person = persons.find((p) => p.id === personId);
    if (!person) {
      return NextResponse.json({ error: "person not found" }, { status: 404 });
    }

    const generated = await generateHintsForPerson(tree.id, person, persons);
    return NextResponse.json({ generated, personId });
  }

  // generate hints for the whole tree
  const result = await generateHintsForTree(tree.id, persons);
  return NextResponse.json(result);
}
