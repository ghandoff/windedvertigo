/**
 * API route: /api/workshop
 *
 * GET   — fetch user's material inventory
 * POST  — toggle a material in/out of inventory
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import {
  getUserMaterials,
  toggleUserMaterial,
} from "@/lib/queries/user-materials";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const materials = await getUserMaterials(session.userId);
  return NextResponse.json({ materials });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { materialId } = body;

    if (typeof materialId !== "string" || !materialId) {
      return NextResponse.json(
        { error: "materialId is required" },
        { status: 400 },
      );
    }

    const added = await toggleUserMaterial(session.userId, materialId);
    return NextResponse.json({ added, materialId });
  } catch (err: unknown) {
    console.error("[workshop] toggle failed:", err);
    return NextResponse.json({ error: "toggle failed" }, { status: 500 });
  }
}
