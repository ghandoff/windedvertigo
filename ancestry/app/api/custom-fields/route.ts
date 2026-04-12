import { NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getCustomFieldKeys } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tree = await getOrCreateTree(session.user.email);
  const keys = await getCustomFieldKeys(tree.id as string);
  return NextResponse.json(keys);
}
