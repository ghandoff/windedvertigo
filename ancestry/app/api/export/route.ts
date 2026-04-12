import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getTreePersons, getTreeRelationships } from "@/lib/db/queries";
import { exportGedcom } from "@/lib/gedcom/exporter";
import { exportGedcom7 } from "@/lib/gedcom/exporter7";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") ?? "gedcom";
  const privacy = searchParams.get("privacy") ?? "redact";

  if (format !== "gedcom" && format !== "gedcom7") {
    return NextResponse.json({ error: "unsupported format" }, { status: 400 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const [persons, relationships] = await Promise.all([
    getTreePersons(tree.id),
    getTreeRelationships(tree.id),
  ]);

  if (persons.length === 0) {
    return NextResponse.json({ error: "no persons in tree" }, { status: 404 });
  }

  const redactLiving = privacy !== "full";

  const gedcom = format === "gedcom7"
    ? exportGedcom7(persons, relationships, [], { redactLiving })
    : exportGedcom(persons, relationships, { redactLiving });

  const treeName = (tree.name ?? "family-tree")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new NextResponse(gedcom, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${treeName}.ged"`,
    },
  });
}
