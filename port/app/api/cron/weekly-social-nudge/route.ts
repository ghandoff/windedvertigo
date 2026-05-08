/**
 * GET /api/cron/weekly-social-nudge
 *
 * Weekly Slack DM to Payton + Garrett asking them to enter LinkedIn and
 * Substack metrics via the strategy-page form.
 *
 * Why a nudge instead of a scrape:
 *   LinkedIn admin analytics + Substack publish dashboard both require
 *   session cookies. CF Workers (where this cron runs) don't have a logged-in
 *   browser, so the only data path is human-in-the-loop. The form takes ~60
 *   seconds — the nudge is the trigger.
 *
 *   Facebook + Instagram public-data scrapes happen automatically inside
 *   getMetaStats() (lib/social/meta.ts) on every sync-social-stats cron run
 *   (every 6 hours), so they don't need a nudge.
 *
 * Skip logic:
 *   If a fresh manual entry exists for both LinkedIn and Substack within
 *   the last 7 days, no DM is sent — avoids nagging when the team already
 *   stayed on top of it. Per-platform: if only LI is stale, the DM only
 *   mentions LI.
 *
 * Schedule: Mondays 9am PT = 17:00 UTC — see lib/scheduled.ts.
 *
 * Auth: Bearer CRON_SECRET, plus the route accepts `?force=true` with a
 * valid Auth.js session for manual trigger from the admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLatestSocialMetric } from "@/lib/marketing/social-metrics";
import { sendDmByEmail } from "@/lib/slack";
import { auth } from "@/lib/auth";

const STRATEGY_FORM_URL = "https://port.windedvertigo.com/strategy?tab=pipeline";
const STALE_DAYS = 7;
// Recipients of the nudge. Garrett is bcc'd so he sees the same nag and can
// fill numbers in himself if Payton's slammed. Easy to extend later — add
// emails here, no other code change needed.
const NUDGE_RECIPIENTS = [
  "payton@windedvertigo.com",
  "garrett@windedvertigo.com",
] as const;

interface PlatformStatus {
  platform: "linkedin" | "substack";
  metricKey: string;
  staleDays: number | null; // null = never entered
  lastValue: number | null;
  lastEntered: string | null; // ISO
}

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

function daysSinceIso(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000));
}

async function buildStatus(
  platform: "linkedin" | "substack",
  metricKey: string,
): Promise<PlatformStatus> {
  const latest = await getLatestSocialMetric(platform, metricKey);
  if (!latest) {
    return { platform, metricKey, staleDays: null, lastValue: null, lastEntered: null };
  }
  return {
    platform,
    metricKey,
    staleDays: daysSinceIso(latest.enteredAt),
    lastValue: latest.value,
    lastEntered: latest.enteredAt,
  };
}

function isStale(s: PlatformStatus): boolean {
  return s.staleDays === null || s.staleDays >= STALE_DAYS;
}

function platformLabel(platform: "linkedin" | "substack"): string {
  return platform === "linkedin" ? "linkedin followers" : "substack subscribers";
}

function formatStatusLine(s: PlatformStatus): string {
  if (s.staleDays === null) {
    return `• *${platformLabel(s.platform)}* — never entered. take 30s to add the current count.`;
  }
  return `• *${platformLabel(s.platform)}* — last entered ${s.staleDays}d ago at ${s.lastValue}. update with this week's number.`;
}

function buildBlocks(stale: PlatformStatus[]) {
  const lines = stale.map(formatStatusLine).join("\n");
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `weekly social-stats nudge — ${stale.length === 2 ? "linkedin + substack are" : `${platformLabel(stale[0].platform)} is`} due for an update.`,
      },
    },
    { type: "section", text: { type: "mrkdwn", text: lines } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `head to <${STRATEGY_FORM_URL}|/strategy → pipeline tab>, click the platform tile, hit *update count*. quick.`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "fb + ig follower counts auto-refresh every 6h via public scrape. linkedin + substack need a session login, so they're manual until the meta dev app + a substack api alternative land.",
        },
      ],
    },
  ];
}

interface NudgeResult {
  ok: true;
  staleCount: number;
  recipientsNotified: number;
  stale: Array<{ platform: string; staleDays: number | null; lastValue: number | null }>;
}

async function runNudge(): Promise<NudgeResult> {
  // Cadence-aligned metric keys: LinkedIn weekly followers, Substack monthly subscribers.
  // The form lets the user enter all sub-metrics — we just check the headline one
  // for staleness because that's what tells us "did they touch the form recently."
  const [li, ss] = await Promise.all([
    buildStatus("linkedin", "followers"),
    buildStatus("substack", "subscribers"),
  ]);

  const stale: PlatformStatus[] = [li, ss].filter(isStale);

  if (stale.length === 0) {
    return {
      ok: true,
      staleCount: 0,
      recipientsNotified: 0,
      stale: [],
    };
  }

  const blocks = buildBlocks(stale);
  const fallbackText = `weekly nudge: ${stale.map((s) => platformLabel(s.platform)).join(" + ")} need updating at ${STRATEGY_FORM_URL}`;

  let notified = 0;
  for (const email of NUDGE_RECIPIENTS) {
    const ok = await sendDmByEmail(email, fallbackText, blocks);
    if (ok) notified++;
  }

  return {
    ok: true,
    staleCount: stale.length,
    recipientsNotified: notified,
    stale: stale.map((s) => ({
      platform: s.platform,
      staleDays: s.staleDays,
      lastValue: s.lastValue,
    })),
  };
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "true";
  const authorized = hasCronAuth(req) || (force && (await isLoggedIn()));
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runNudge());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[weekly-social-nudge]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
