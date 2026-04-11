import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, createPerson, searchPersons } from "@/lib/db/queries";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const body = await req.json();

  const { givenNames, surname, sex, isLiving, birthDate, deathDate } = body;

  if (!givenNames && !surname) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const personId = await createPerson({
    treeId: tree.id,
    sex,
    isLiving,
    givenNames: givenNames ?? "",
    surname: surname ?? "",
    birthDate,
    deathDate,
  });

  return NextResponse.json({ id: personId });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const query = req.nextUrl.searchParams.get("q");

  if (query) {
    const results = await searchPersons(tree.id, query);
    return NextResponse.json(results);
  }

  return NextResponse.json({ error: "provide ?q= parameter" }, { status: 400 });
}
