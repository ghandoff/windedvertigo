/**
 * GET /api/cron/refresh-linkedin
 *
 * Monthly cron to refresh LinkedIn access token using the refresh token.
 * Configured in vercel.json with CRON_SECRET for security.
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshLinkedInToken } from "@/lib/social/linkedin-token";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshLinkedInToken();
    console.log(
      `[cron/refresh-linkedin] success — new token expires in ${result.expiresInDays} days, refresh rotated: ${result.refreshTokenRotated}`,
    );

    return NextResponse.json({
      success: true,
      expiresInDays: result.expiresInDays,
      refreshTokenRotated: result.refreshTokenRotated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[cron/refresh-linkedin]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
