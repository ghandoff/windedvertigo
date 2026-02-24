import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { updatePrefs } from "@/lib/queries/notifications";

/**
 * GET /api/notifications/unsubscribe?token=...
 *
 * One-click unsubscribe from digest emails. Verifies the HMAC token,
 * disables the digest for that user, and redirects to the profile page
 * with a confirmation banner.
 *
 * Session 21: notification digest system.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/profile?unsubscribed=error", request.url));
  }

  const userId = verifyUnsubscribeToken(token);

  if (!userId) {
    return NextResponse.redirect(new URL("/profile?unsubscribed=error", request.url));
  }

  try {
    await updatePrefs(userId, { digestEnabled: false, digestFrequency: "never" });
    return NextResponse.redirect(new URL("/profile?unsubscribed=true", request.url));
  } catch (err: any) {
    console.error("[unsubscribe] failed:", err);
    return NextResponse.redirect(new URL("/profile?unsubscribed=error", request.url));
  }
}
