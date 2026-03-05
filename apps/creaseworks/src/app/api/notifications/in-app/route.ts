import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import {
  getUserNotifications,
  getUnreadCount,
  markAllNotificationsRead,
} from "@/lib/queries/notifications";

/**
 * GET /api/notifications/in-app
 *
 * Returns recent in-app notifications for the current user.
 * Query params:
 *  - unreadOnly: "1" to filter to unread only
 *  - limit: number (default 20, max 50)
 *  - offset: number (default 0)
 *  - countOnly: "1" to return just the unread count (for badge polling)
 *
 * Session 47: in-app notification center.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const url = new URL(request.url);
  const countOnly = url.searchParams.get("countOnly") === "1";

  if (countOnly) {
    const count = await getUnreadCount(session.userId, session.uiTier);
    return NextResponse.json({ unreadCount: count });
  }

  const unreadOnly = url.searchParams.get("unreadOnly") === "1";
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
    50,
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(session.userId, { limit, offset, unreadOnly, userTier: session.uiTier }),
    getUnreadCount(session.userId, session.uiTier),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

/**
 * POST /api/notifications/in-app
 *
 * Mark all notifications as read.
 * Body: { action: "mark_all_read" }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.action === "mark_all_read") {
      const count = await markAllNotificationsRead(session.userId);
      return NextResponse.json({ marked: count });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}
