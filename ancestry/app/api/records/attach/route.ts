import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { createSource, createCitation, getOrCreateTree } from "@/lib/db/queries";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { treeId, personId, title, sourceType, url, snippet, source } = body;

  if (!treeId || !personId || !title) {
    return NextResponse.json({ error: "treeId, personId, and title are required" }, { status: 400 });
  }

  // verify user owns the tree
  const tree = await getOrCreateTree(session.user.email);
  if (tree.id !== treeId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // create a source entry for this record
  const sourceId = await createSource(treeId, {
    title,
    sourceType: sourceType ?? (source === "chronicling_america" ? "newspaper" : "vital_record"),
    url: url ?? null,
    notes: snippet ?? null,
    publisher: source === "familysearch"
      ? "FamilySearch"
      : source === "chronicling_america"
        ? "Library of Congress — Chronicling America"
        : null,
  });

  if (!sourceId) {
    return NextResponse.json({ error: "failed to create source" }, { status: 500 });
  }

  // create a citation linking source to the person (no specific event yet)
  const citationId = await createCitation({
    sourceId,
    extract: snippet ?? null,
    notes: `attached from record search (${source})`,
  });

  return NextResponse.json({ sourceId, citationId });
}
