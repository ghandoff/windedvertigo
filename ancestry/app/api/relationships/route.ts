import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, createRelationship } from "@/lib/db/queries";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const body = await req.json();

  const { person1Id, person2Id, relationshipType } = body;

  if (!person1Id || !person2Id || !relationshipType) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const id = await createRelationship({
    treeId: tree.id,
    person1Id,
    person2Id,
    relationshipType,
  });

  return NextResponse.json({ id });
}
