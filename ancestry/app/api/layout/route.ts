import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import {
  getOrCreateTree,
  saveLayoutPositions,
  clearLayoutPositions,
  type LayoutPositions,
} from "@/lib/db/queries";

/** PATCH — merge updated node positions into saved layout */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const body = await req.json();
  const positions: LayoutPositions = body.positions;

  if (!positions || typeof positions !== "object") {
    return NextResponse.json({ error: "positions object required" }, { status: 400 });
  }

  await saveLayoutPositions(tree.id as string, positions);
  return NextResponse.json({ ok: true });
}

/** DELETE — clear all saved positions (reset to auto-layout) */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  await clearLayoutPositions(tree.id as string);
  return NextResponse.json({ ok: true });
}
