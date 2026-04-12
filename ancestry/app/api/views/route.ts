import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getSavedViews, addSavedView, deleteSavedView } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const views = await getSavedViews(tree.id as string);
  return NextResponse.json(views);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const view = await req.json();
  await addSavedView(tree.id as string, view);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const { viewId } = await req.json();
  await deleteSavedView(tree.id as string, viewId);
  return NextResponse.json({ ok: true });
}
