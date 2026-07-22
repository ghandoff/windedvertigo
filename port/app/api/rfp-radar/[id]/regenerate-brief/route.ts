/**
 * POST /api/rfp-radar/{id}/regenerate-brief
 *
 * Regenerate the one-pager brief from the card's (ideally verified) TOR and
 * refresh the TOR thumbnail. Lightweight — a single Haiku call, no queue.
 * Provenance is derived from the card's real state (see regenerateBriefFromTor).
 *
 * Auth: Bearer CRON_SECRET (for auto-triggers inside other routes) OR session.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";
import { regenerateBriefFromTor } from "@/lib/rfp/regenerate-brief";

async function getBrowser(): Promise<unknown> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx as { env: { BROWSER?: unknown } }).env.BROWSER ?? null;
  } catch {
    return null;
  }
}

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!verifyCronAuth(req)) {
    const session = await auth();
    if (!session?.user?.email) return error("unauthorized", 401);
  }

  const browser = await getBrowser();
  const result = await regenerateBriefFromTor(id, browser);
  if (!result.ok) return error("failed to regenerate brief", 500);
  return json(result);
}
