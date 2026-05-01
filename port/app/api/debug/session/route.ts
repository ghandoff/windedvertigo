/**
 * GET /api/debug/session — temporary diagnostic endpoint
 * Shows what fields are present in the current session/JWT.
 * Delete after debugging the calendar token issue.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const s = session as unknown as Record<string, unknown>;

  return NextResponse.json({
    user: {
      email: session.user?.email,
      name: session.user?.name,
    },
    hasAccessToken:    !!s.accessToken,
    accessTokenPrefix: typeof s.accessToken === "string" ? s.accessToken.slice(0, 20) + "..." : null,
    hasRefreshToken:   !!(s as Record<string, unknown>).refreshToken,
    firstName:         s.firstName,
    expiresAt:         s.expiresAt,
    sessionKeys:       Object.keys(s),
  });
}
