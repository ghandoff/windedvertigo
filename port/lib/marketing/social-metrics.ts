/**
 * port/lib/marketing/social-metrics.ts
 *
 * Manual-entry social-metrics read/write layer. Phase 1 of the social
 * analytics integration (see port/docs/social-media-integration-plan.md).
 *
 * The wv team enters weekly/monthly numbers via the SocialMetricsForm on
 * /strategy. This module persists + reads them. The KpiSourceModal +
 * getSocialStatsFromSnapshot overlay reads on top of cron-snapshot API
 * data so the KPI tiles stay live even when meta/linkedin/substack APIs
 * are NULL.
 */

import { supabase } from "@/lib/supabase/client";

// ── canonical platform + metric keys ────────────────────────────────

export const SOCIAL_PLATFORMS = [
  "substack",
  "linkedin",
  "instagram",
  "facebook",
  "bluesky",
  "tiktok",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Per-platform set of metric keys we accept. The form validates against
 * this map; the API route validates against this map; the read path
 * keys results by metric_key. Keep in sync with the form + the
 * getSocialStatsFromSnapshot overlay logic.
 */
export const SOCIAL_METRIC_KEYS: Record<SocialPlatform, readonly string[]> = {
  substack: ["subscribers"],
  linkedin: ["followers", "posts_published", "recent_engagement"],
  instagram: ["followers", "recent_reach", "recent_engagement"],
  facebook: ["page_followers", "recent_engagement"],
  bluesky: ["followers"],
  tiktok: ["followers", "recent_engagement"],
};

/** Cadence per platform — drives form copy + period defaults. */
export const SOCIAL_PLATFORM_CADENCE: Record<SocialPlatform, "weekly" | "monthly"> = {
  substack: "monthly",
  linkedin: "weekly",
  instagram: "weekly",
  facebook: "weekly",
  bluesky: "weekly",
  tiktok: "weekly",
};

// ── row shape ───────────────────────────────────────────────────────

export interface SocialMetricRow {
  id: string;
  platform: SocialPlatform;
  metricKey: string;
  value: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  enteredByEmail: string;
  enteredByName: string | null;
  enteredAt: string; // ISO
  note: string | null;
}

interface DbRow {
  id: string;
  platform: SocialPlatform;
  metric_key: string;
  value: number;
  period_start: string;
  period_end: string;
  entered_by_email: string;
  entered_by_name: string | null;
  entered_at: string;
  note: string | null;
}

function rowFromDb(r: DbRow): SocialMetricRow {
  return {
    id: r.id,
    platform: r.platform,
    metricKey: r.metric_key,
    value: r.value,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    enteredByEmail: r.entered_by_email,
    enteredByName: r.entered_by_name,
    enteredAt: r.entered_at,
    note: r.note,
  };
}

// ── period helpers ──────────────────────────────────────────────────

/** Monday of the week containing `date`, formatted as YYYY-MM-DD. */
export function mondayOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function todayDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** First day of the current month, formatted as YYYY-MM-DD. */
export function firstOfMonth(date: Date = new Date()): string {
  const d = new Date(date);
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

// ── read path ───────────────────────────────────────────────────────

/**
 * Returns the latest row per metric_key for a given platform. The
 * KpiSourceModal + getSocialStatsFromSnapshot use this to overlay manual
 * entries on top of the cron-fetched API data.
 */
export async function getLatestSocialMetrics(
  platform: SocialPlatform,
): Promise<Record<string, SocialMetricRow>> {
  // We fetch all rows for the platform ordered by period_end desc, then
  // pick the first hit per metric_key. Supabase doesn't support
  // DISTINCT ON via the JS client, but a small in-memory dedupe over
  // ~hundreds of rows is fine forever.
  const { data, error } = await supabase
    .from("social_metrics")
    .select("*")
    .eq("platform", platform)
    .order("period_end", { ascending: false })
    .order("entered_at", { ascending: false })
    .limit(500);
  if (error) {
    console.warn(
      `[social-metrics] getLatestSocialMetrics(${platform}):`,
      error.message,
    );
    return {};
  }
  const map: Record<string, SocialMetricRow> = {};
  for (const r of (data ?? []) as DbRow[]) {
    if (!map[r.metric_key]) map[r.metric_key] = rowFromDb(r);
  }
  return map;
}

/**
 * Latest entry for a single (platform, metric_key) pair. Convenience
 * wrapper around getLatestSocialMetrics for callers that only need one.
 */
export async function getLatestSocialMetric(
  platform: SocialPlatform,
  metricKey: string,
): Promise<SocialMetricRow | null> {
  const all = await getLatestSocialMetrics(platform);
  return all[metricKey] ?? null;
}

/** Returns the latest manual entries across ALL platforms, keyed by
 *  `${platform}:${metric_key}`. Used by getSocialStatsFromSnapshot. */
export async function getAllLatestSocialMetrics(): Promise<
  Record<string, SocialMetricRow>
> {
  const { data, error } = await supabase
    .from("social_metrics")
    .select("*")
    .order("period_end", { ascending: false })
    .order("entered_at", { ascending: false })
    .limit(2000);
  if (error) {
    console.warn(`[social-metrics] getAllLatestSocialMetrics:`, error.message);
    return {};
  }
  const map: Record<string, SocialMetricRow> = {};
  for (const r of (data ?? []) as DbRow[]) {
    const key = `${r.platform}:${r.metric_key}`;
    if (!map[key]) map[key] = rowFromDb(r);
  }
  return map;
}

// ── write path ──────────────────────────────────────────────────────

export interface InsertSocialMetricInput {
  platform: SocialPlatform;
  metricKey: string;
  value: number;
  /** YYYY-MM-DD; defaults to monday of current week (weekly) or first of month (monthly) */
  periodStart?: string;
  /** YYYY-MM-DD; defaults to today */
  periodEnd?: string;
  enteredByEmail: string;
  enteredByName?: string | null;
  note?: string | null;
}

/**
 * Insert a new metric row. Returns the new row's id. Throws on validation
 * or DB errors so the API route can surface a 400/500.
 */
export async function insertSocialMetric(
  input: InsertSocialMetricInput,
): Promise<{ id: string }> {
  const { platform, metricKey, value, enteredByEmail, enteredByName, note } = input;

  // ── validate platform + metric_key ────────────────────────────────
  if (!SOCIAL_PLATFORMS.includes(platform)) {
    throw new Error(`invalid platform: ${platform}`);
  }
  const allowed = SOCIAL_METRIC_KEYS[platform];
  if (!allowed.includes(metricKey)) {
    throw new Error(
      `invalid metric_key for ${platform}: ${metricKey} (allowed: ${allowed.join(", ")})`,
    );
  }
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new Error(`invalid value: must be integer 0-1000000`);
  }
  if (!enteredByEmail) {
    throw new Error("entered_by_email is required");
  }

  // ── default periods based on cadence ──────────────────────────────
  const cadence = SOCIAL_PLATFORM_CADENCE[platform];
  const periodEnd = input.periodEnd ?? todayDate();
  const periodStart =
    input.periodStart ?? (cadence === "monthly" ? firstOfMonth() : mondayOfWeek());

  const { data, error } = await supabase
    .from("social_metrics")
    .insert({
      platform,
      metric_key: metricKey,
      value,
      period_start: periodStart,
      period_end: periodEnd,
      entered_by_email: enteredByEmail,
      entered_by_name: enteredByName ?? null,
      note: note ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`insert failed: ${error?.message ?? "no data"}`);
  }
  return { id: data.id };
}
