/**
 * GET /api/debug/token-info — temporary diagnostic endpoint
 * Calls Google's tokeninfo endpoint to show exactly what scopes
 * the current access token was granted. Delete after debugging.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const s = session as unknown as Record<string, unknown>;
  const accessToken = s.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "no access token in session" });
  }

  // Probe Google tokeninfo — returns scope, expiry, email, etc.
  const res = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`,
  );
  const tokenInfo = await res.json() as Record<string, unknown>;

  return NextResponse.json({
    tokenInfoStatus: res.status,
    scope:           tokenInfo.scope,
    email:           tokenInfo.email,
    expiresIn:       tokenInfo.exp,
    hasCalendarScope: typeof tokenInfo.scope === "string"
      ? tokenInfo.scope.includes("calendar")
      : false,
    raw: tokenInfo,
  });
}
