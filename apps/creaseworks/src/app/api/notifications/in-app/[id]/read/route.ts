import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { markNotificationRead } from "@/lib/queries/notifications";

/**
 * POST /api/notifications/in-app/:id/read
 *
 * Mark a single notification as read.
 *
 * Session 47: in-app notification center.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;
  const marked = await markNotificationRead(id, session.userId);

  if (!marked) {
    return NextResponse.json(
      { error: "not found or already read" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
