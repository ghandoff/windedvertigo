import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { updatePrefs } from "@/lib/queries/notifications";

const BASE_PATH = "/reservoir/creaseworks";

/**
 * GET /api/notifications/unsubscribe?token=...
 *
 * One-click unsubscribe from digest emails. Verifies the HMAC token,
 * disables the digest for that user, and redirects to the profile page
 * with a confirmation banner.
 *
 * Session 21: notification digest system.
 */

/** Build a redirect URL that preserves the basePath. */
function profileRedirect(request: Request, query: string) {
  const url = new URL(request.url);
  // Ensure basePath appears exactly once
  const prefix = url.pathname.startsWith(BASE_PATH) ? "" : BASE_PATH;
  url.pathname = `${prefix}/profile`;
  url.search = query;
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return profileRedirect(request, "?unsubscribed=error");
  }

  const userId = verifyUnsubscribeToken(token);

  if (!userId) {
    return profileRedirect(request, "?unsubscribed=error");
  }

  try {
    await updatePrefs(userId, { digestEnabled: false, digestFrequency: "never" });
    return profileRedirect(request, "?unsubscribed=true");
  } catch (err: any) {
    console.error("[unsubscribe] failed:", err);
    return profileRedirect(request, "?unsubscribed=error");
  }
}
