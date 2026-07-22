/**
 * POST /api/rfp-radar/{id}/thumbnail
 *
 * Generate (or refresh) the TOR thumbnail for a card — a screenshot of the TOR
 * document (or source page) so a human can visually confirm a real TOR is
 * attached. Backs the "refresh thumbnail" button on the detail page.
 *
 * Auth: Bearer CRON_SECRET OR session.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";
import { getRfpOpportunityByIdFromSupabase, setRfpTorThumbnail } from "@/lib/supabase/rfp-opportunities";
import { generateTorThumbnail } from "@/lib/rfp/tor-thumbnail";

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

  const rfp = await getRfpOpportunityByIdFromSupabase(id).catch(() => null);
  if (!rfp) return error("opportunity not found", 404);

  const target = rfp.rfpDocumentUrl ?? (rfp.url || null);
  if (!target) return json({ thumbnailUrl: null, skipped: "no TOR or source URL" });

  const browser = await getBrowser();
  if (!browser) return json({ thumbnailUrl: null, skipped: "browser rendering unavailable" });

  const thumbnailUrl = await generateTorThumbnail(id, target, browser);
  if (thumbnailUrl) await setRfpTorThumbnail(id, thumbnailUrl);
  return json({ thumbnailUrl });
}
