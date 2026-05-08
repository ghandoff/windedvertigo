/**
 * GET  /api/cron/sync-social-stats              — bearer auth (cron)
 * GET  /api/cron/sync-social-stats?force=true   — session cookie auth (manual sync)
 * POST /api/cron/sync-social-stats              — session cookie auth (manual sync)
 *
 * Aggregates engagement stats from the port's own email_drafts table plus
 * LinkedIn, Substack, Meta (FB + IG), and Bluesky into a single snapshot
 * and writes it to Supabase under `marketing_state.key = 'social-stats'`
 * (conceptual KV key: `marketing:social-stats`). Powers the /strategy
 * sidebar cards.
 *
 * Schedule: every 6 hours (UTC 03/09/15/21) — see lib/scheduled.ts.
 *
 * Auth:
 *   - Bearer CRON_SECRET (cron path)
 *   - or `force=true` query param + a valid Auth.js session cookie (manual)
 *   - or POST with a valid Auth.js session cookie (sidebar "sync now" button)
 *
 * Required env vars:
 *   CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 * Optional (each platform degrades to nulls if missing):
 *   LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN
 *   SUBSTACK_PUBLICATION, SUBSTACK_COOKIE
 *   META_PAGE_ACCESS_TOKEN, META_PAGE_ID, META_IG_USER_ID
 *   BLUESKY_HANDLE
 */

import { NextRequest, NextResponse } from "next/server";
import { getLinkedInStats } from "@/lib/social/linkedin";
import { getSubstackStats } from "@/lib/social/substack";
import { getMetaStats } from "@/lib/social/meta";
import { getBlueskyStats } from "@/lib/social/bluesky";
import { getPortCampaignStats } from "@/lib/marketing/port-campaign-stats";
import {
  buildSnapshot,
  writeSocialStatsSnapshot,
  SOCIAL_STATS_KEY,
} from "@/lib/marketing/social-stats";
import { auth } from "@/lib/auth";

function hasCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

async function isLoggedIn(): Promise<boolean> {
  try {
    const session = await auth();
    return !!session?.user;
  } catch {
    return false;
  }
}

async function runSync() {
  const [linkedinRes, substackRes, metaRes, blueskyRes, portRes] =
    await Promise.allSettled([
      getLinkedInStats(),
      getSubstackStats(),
      getMetaStats(),
      getBlueskyStats(),
      getPortCampaignStats(),
    ]);

  const snapshot = buildSnapshot({
    linkedin: linkedinRes.status === "fulfilled" ? linkedinRes.value : null,
    substack: substackRes.status === "fulfilled" ? substackRes.value : null,
    meta: metaRes.status === "fulfilled" ? metaRes.value : null,
    bluesky: blueskyRes.status === "fulfilled" ? blueskyRes.value : null,
    port: portRes.status === "fulfilled" ? portRes.value : null,
  });

  const errors: Record<string, string> = {};
  if (linkedinRes.status === "rejected")
    errors.linkedin = String(linkedinRes.reason);
  if (substackRes.status === "rejected")
    errors.substack = String(substackRes.reason);
  if (metaRes.status === "rejected") errors.meta = String(metaRes.reason);
  if (blueskyRes.status === "rejected")
    errors.bluesky = String(blueskyRes.reason);
  if (portRes.status === "rejected") errors.port = String(portRes.reason);

  let writeError: string | null = null;
  try {
    await writeSocialStatsSnapshot(snapshot);
  } catch (err) {
    writeError = err instanceof Error ? err.message : String(err);
    console.error("[sync-social-stats] write failed", writeError);
  }

  return {
    ok: writeError === null,
    key: SOCIAL_STATS_KEY,
    snapshot,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    writeError,
  };
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "true";
  const authorized =
    hasCronAuth(req) || (force && (await isLoggedIn()));
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runSync());
}

export async function POST(req: NextRequest) {
  // Manual sync from the strategy page sidebar — requires an auth.js session.
  const authorized = hasCronAuth(req) || (await isLoggedIn());
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runSync());
}
