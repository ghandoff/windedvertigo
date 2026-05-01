/**
 * POST /api/rfp-radar/sync — session-authenticated manual feed sync.
 *
 * Proxies to poll-rss using the CRON_SECRET so logged-in users can
 * trigger a feed sync from the UI without exposing the secret to the browser.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const origin = req.nextUrl.origin;
  const res = await fetch(`${origin}/api/rfp-radar/poll-rss`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  const data = await res.json();
  return json(data);
}
