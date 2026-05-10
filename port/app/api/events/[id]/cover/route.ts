/**
 * POST /api/events/{id}/cover
 *
 * Generate or refresh a cover image for a conference event.
 *
 * Flow:
 *   1. Load the event from Supabase (needs the URL and affiliated_org_id)
 *   2. Call fetchCoverImage() — cascades from og:image → screenshot → null
 *   3. If a URL is produced: PATCH crm_events.cover_image_url
 *   4. Return { coverImageUrl: string | null }
 *
 * Auth: Authorization: Bearer {CRON_SECRET} OR Auth.js session
 *       (session auth allows the gallery "Refresh cover" button; cron auth
 *        allows discovery routes to call this inside ctx.waitUntil()).
 *
 * The BROWSER binding is passed from getCloudflareContext().env when
 * available; it is optional — the cascade degrades gracefully without it.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";
import { getEventByIdFromSupabase, upsertEventToSupabase } from "@/lib/supabase/events";
import { fetchCoverImage } from "@/lib/conferences/cover-image";

// CF Workers provides `getCloudflareContext` from openNext internals
type CloudflareContextWithBrowser = {
  env: {
    BROWSER?: unknown;
  };
};

async function getCfEnv(): Promise<CloudflareContextWithBrowser["env"]> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx as CloudflareContextWithBrowser).env;
  } catch {
    return {};
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

  // Auth: cron secret or logged-in session
  const isCron = verifyCronAuth(req);
  if (!isCron) {
    const session = await auth();
    if (!session?.user?.email) {
      return error("unauthorized", 401);
    }
  }

  try {
    const evt = await getEventByIdFromSupabase(id);
    if (!evt) return error("event not found", 404);

    if (!evt.url) {
      return json({ coverImageUrl: null, skipped: "no event URL" });
    }

    // Get BROWSER binding if running on CF Workers
    const cfEnv = await getCfEnv();
    const browserBinding = cfEnv.BROWSER ?? null;

    const coverImageUrl = await fetchCoverImage({
      url: evt.url,
      eventId: id,
      browserBinding,
    });

    if (coverImageUrl) {
      await upsertEventToSupabase(id, { cover_image_url: coverImageUrl } as Parameters<typeof upsertEventToSupabase>[1]);
    }

    return json({ coverImageUrl });
  } catch (err) {
    console.error("[api/events/[id]/cover] POST failed:", err);
    return error("failed to generate cover image", 500);
  }
}
