/**
 * Aggregated marketing-engagement snapshot used by the strategy page sidebar.
 *
 * Storage: a single-row Supabase table `marketing_state` keyed by
 * `key = 'social-stats'`. We use Supabase rather than Cloudflare KV because
 * (a) Supabase is already wired into port and (b) port doesn't currently bind
 * a KV namespace. The conceptual key is `marketing:social-stats`.
 *
 * Read path: getSocialStatsFromSnapshot() — used by the strategy server
 * component. Returns `null` on any error so the page can degrade gracefully.
 *
 * Write path: writeSocialStatsSnapshot() — used by the sync-social-stats cron.
 *
 * Required Supabase migration (see port/supabase/migrations):
 *   create table marketing_state (
 *     key text primary key,
 *     value jsonb not null,
 *     updated_at timestamptz not null default now()
 *   );
 */

import type { LinkedInStats } from "@/lib/social/linkedin";
import type { SubstackStats } from "@/lib/social/substack";
import type { MetaStats } from "@/lib/social/meta";
import type { BlueskyStats } from "@/lib/social/bluesky";
import type { PortCampaignStats } from "@/lib/marketing/port-campaign-stats";
import { supabase } from "@/lib/supabase/client";

export const SOCIAL_STATS_KEY = "marketing:social-stats";
const TABLE = "marketing_state";
const ROW_KEY = "social-stats";

export interface SocialStatsSnapshot {
  linkedin: LinkedInStats | null;
  substack: SubstackStats | null;
  meta: MetaStats | null;
  bluesky: BlueskyStats | null;
  /** real first-party port email-campaign data (always present) */
  port: PortCampaignStats | null;
  /** sum of follower counts across all platforms (skipping nulls) +
   *  port unique recipients — proxy for total reach */
  totalFollowers: number;
  /** sum of recent-post engagement across all platforms (last 90d) +
   *  port email opens + clicks — total engagement events */
  totalRecentEngagement: number;
  /** alias for totalRecentEngagement, kept for clarity at the call site */
  totalEngagement: number;
  /** substack.totalSubscribers ?? 0 (kept for the dedicated subscribers card) */
  totalSubscribers: number;
  /** explicit "we've sent N emails" framing for the campaign-reach card */
  totalCampaignActivity: number;
  generatedAt: string;
}

export function buildSnapshot(parts: {
  linkedin: LinkedInStats | null;
  substack: SubstackStats | null;
  meta: MetaStats | null;
  bluesky: BlueskyStats | null;
  port: PortCampaignStats | null;
}): SocialStatsSnapshot {
  const { linkedin, substack, meta, bluesky, port } = parts;

  const followerParts = [
    port?.uniqueRecipients,
    linkedin?.followerCount,
    substack?.totalSubscribers,
    meta?.facebookPageFollowers,
    meta?.instagramFollowers,
    bluesky?.followerCount,
  ];
  const totalFollowers = followerParts.reduce<number>(
    (sum, n) => sum + (typeof n === "number" ? n : 0),
    0,
  );

  const engagementParts = [
    port?.totalOpens ?? 0,
    port?.totalClicks ?? 0,
    linkedin?.recentPostEngagement ?? 0,
    meta?.instagramRecentEngagement ?? 0,
    meta?.facebookRecentEngagement ?? 0,
    bluesky?.recentPostEngagement ?? 0,
  ];
  const totalRecentEngagement = engagementParts.reduce<number>((sum, n) => sum + n, 0);

  const totalSubscribers = substack?.totalSubscribers ?? 0;
  const totalCampaignActivity = port?.totalEmailsSent ?? 0;

  return {
    linkedin,
    substack,
    meta,
    bluesky,
    port,
    totalFollowers,
    totalRecentEngagement,
    totalEngagement: totalRecentEngagement,
    totalSubscribers,
    totalCampaignActivity,
    generatedAt: new Date().toISOString(),
  };
}

export async function writeSocialStatsSnapshot(
  snapshot: SocialStatsSnapshot,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { key: ROW_KEY, value: snapshot, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) {
    throw new Error(`[marketing/social-stats] write: ${error.message}`);
  }
}

/**
 * Read the latest snapshot from Supabase, then overlay any manual
 * `social_metrics` entries on top so KPI tiles stay live even when the
 * platform integrations return NULL.
 *
 * Overlay rules (manual entry wins for NULL fields):
 *   - substack.totalSubscribers: from social_metrics.platform=substack
 *     metric_key=subscribers if API value is null
 *   - linkedin.followerCount: from linkedin/followers
 *   - linkedin.recentPostEngagement: from linkedin/recent_engagement
 *   - meta.instagramFollowers: from instagram/followers
 *   - meta.instagramRecentEngagement: from instagram/recent_engagement
 *   - meta.facebookPageFollowers: from facebook/page_followers
 *   - meta.facebookRecentEngagement: from facebook/recent_engagement
 *   - bluesky.followerCount: from bluesky/followers if API failed
 *
 * After overlay, totalFollowers + totalEngagement + totalSubscribers
 * are recomputed so aggregates reflect the manual entries.
 *
 * Returns null on any error so callers can degrade gracefully.
 */
export async function getSocialStatsFromSnapshot(): Promise<SocialStatsSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("value")
      .eq("key", ROW_KEY)
      .maybeSingle();
    if (error) {
      console.warn("[marketing/social-stats] read error", error.message);
      return null;
    }
    if (!data?.value) return null;

    const snapshot = data.value as SocialStatsSnapshot;
    return await overlayManualEntries(snapshot);
  } catch (err) {
    console.warn("[marketing/social-stats] read exception", err);
    return null;
  }
}

/**
 * Layer manual social_metrics entries on top of the cron snapshot. Manual
 * entries fill in NULL platform fields. Recomputes the aggregate totals
 * (totalFollowers, totalEngagement, totalSubscribers) afterwards so the
 * KPI tiles match the breakdown.
 */
async function overlayManualEntries(
  snapshot: SocialStatsSnapshot,
): Promise<SocialStatsSnapshot> {
  const { getAllLatestSocialMetrics } = await import("./social-metrics");
  const manual = await getAllLatestSocialMetrics();

  // Helper: pick API value first, fall back to manual entry's value.
  const pick = (apiValue: number | null | undefined, key: string): number | null => {
    if (typeof apiValue === "number") return apiValue;
    const m = manual[key];
    return m ? m.value : null;
  };

  // ── per-platform overlay ─────────────────────────────────────────
  const substack = snapshot.substack
    ? {
        ...snapshot.substack,
        totalSubscribers: pick(
          snapshot.substack.totalSubscribers,
          "substack:subscribers",
        ),
      }
    : { totalSubscribers: pick(null, "substack:subscribers"),
        freeSubscribers: null,
        paidSubscribers: null,
        recentPostViews: null,
        fetchedAt: new Date().toISOString() };

  const linkedin = snapshot.linkedin
    ? {
        ...snapshot.linkedin,
        followerCount: pick(snapshot.linkedin.followerCount, "linkedin:followers"),
        recentPostEngagement: pick(
          snapshot.linkedin.recentPostEngagement,
          "linkedin:recent_engagement",
        ) ?? snapshot.linkedin.recentPostEngagement ?? 0,
      }
    : { followerCount: pick(null, "linkedin:followers"),
        recentPostEngagement: pick(null, "linkedin:recent_engagement") ?? 0,
        recentPostImpressions: null,
        fetchedAt: new Date().toISOString() };

  const meta = snapshot.meta
    ? {
        ...snapshot.meta,
        instagramFollowers: pick(
          snapshot.meta.instagramFollowers,
          "instagram:followers",
        ),
        instagramRecentEngagement: pick(
          snapshot.meta.instagramRecentEngagement,
          "instagram:recent_engagement",
        ) ?? snapshot.meta.instagramRecentEngagement ?? 0,
        facebookPageFollowers: pick(
          snapshot.meta.facebookPageFollowers,
          "facebook:page_followers",
        ),
        facebookRecentEngagement: pick(
          snapshot.meta.facebookRecentEngagement,
          "facebook:recent_engagement",
        ) ?? snapshot.meta.facebookRecentEngagement ?? 0,
      }
    : { instagramFollowers: pick(null, "instagram:followers"),
        instagramRecentEngagement: pick(null, "instagram:recent_engagement") ?? 0,
        facebookPageFollowers: pick(null, "facebook:page_followers"),
        facebookRecentEngagement: pick(null, "facebook:recent_engagement") ?? 0,
        fetchedAt: new Date().toISOString() };

  const bluesky = snapshot.bluesky
    ? {
        ...snapshot.bluesky,
        followerCount: pick(snapshot.bluesky.followerCount, "bluesky:followers"),
      }
    : snapshot.bluesky;

  // ── recompute aggregates so the tiles reflect manual entries ──────
  const port = snapshot.port;
  const followerParts = [
    port?.uniqueRecipients,
    linkedin?.followerCount,
    substack?.totalSubscribers,
    meta?.facebookPageFollowers,
    meta?.instagramFollowers,
    bluesky?.followerCount,
  ];
  const totalFollowers = followerParts.reduce<number>(
    (sum, n) => sum + (typeof n === "number" ? n : 0),
    0,
  );

  const engagementParts = [
    port?.totalOpens ?? 0,
    port?.totalClicks ?? 0,
    linkedin?.recentPostEngagement ?? 0,
    meta?.instagramRecentEngagement ?? 0,
    meta?.facebookRecentEngagement ?? 0,
    bluesky?.recentPostEngagement ?? 0,
  ];
  const totalRecentEngagement = engagementParts.reduce<number>(
    (sum, n) => sum + n,
    0,
  );

  const totalSubscribers = substack?.totalSubscribers ?? 0;

  return {
    ...snapshot,
    substack,
    linkedin,
    meta,
    bluesky,
    totalFollowers,
    totalRecentEngagement,
    totalEngagement: totalRecentEngagement,
    totalSubscribers,
  };
}
