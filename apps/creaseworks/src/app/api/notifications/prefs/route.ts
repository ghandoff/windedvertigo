import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { getOrCreatePrefs, updatePrefs } from "@/lib/queries/notifications";

/**
 * GET /api/notifications/prefs
 *
 * Returns current user's notification preferences.
 * Creates a default row if none exists.
 *
 * Session 21: notification digest system.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const prefs = await getOrCreatePrefs(session.userId);
  return NextResponse.json(prefs);
}

/**
 * PATCH /api/notifications/prefs
 *
 * Update notification preferences. Accepts:
 * { digestEnabled?: boolean, digestFrequency?: "weekly" | "never" }
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updates: { digestEnabled?: boolean; digestFrequency?: "weekly" | "never" } = {};

    if (typeof body.digestEnabled === "boolean") {
      updates.digestEnabled = body.digestEnabled;
    }
    if (body.digestFrequency === "weekly" || body.digestFrequency === "never") {
      updates.digestFrequency = body.digestFrequency;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
    }

    // If toggling digest on, set frequency to weekly; if off, set to never
    if (updates.digestEnabled === true && !updates.digestFrequency) {
      updates.digestFrequency = "weekly";
    }
    if (updates.digestEnabled === false && !updates.digestFrequency) {
      updates.digestFrequency = "never";
    }

    await updatePrefs(session.userId, updates);
    const prefs = await getOrCreatePrefs(session.userId);
    return NextResponse.json(prefs);
  } catch (err: any) {
    console.error("[prefs] update failed:", err);
    return NextResponse.json(
      { error: err.message ?? "update failed" },
      { status: 500 },
    );
  }
}
