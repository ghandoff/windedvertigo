/**
 * GET /api/cron/relationship-alerts
 *
 * Runs daily at 1pm UTC (9am ET).
 * Surfaces stale deals and cold relationships, posts digest to Slack.
 *
 * Stale deal:   stage not "won"/"lost", lastEditedTime > 14 days ago
 * Cold contact: outreachStatus "Contacted"|"In conversation"|"Proposal sent",
 *               no activity in 21+ days (or no activity at all)
 */

import { NextRequest, NextResponse } from "next/server";
import { queryDeals } from "@/lib/notion/deals";
import { queryOrganizations } from "@/lib/notion/organizations";
import { getActivitiesForOrg } from "@/lib/notion/activities";
import { callClaude } from "@/lib/ai/client";
import { postToSlack } from "@/lib/slack";

const STALE_DEAL_DAYS = 14;
const COLD_ORG_DAYS = 21;
const MAX_ORGS_TO_CHECK = 25;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

function daysAgo(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86_400_000);
}

interface StaleItem {
  name: string;
  detail: string;
  daysAgo: number;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const staleDeals: StaleItem[] = [];
  const coldOrgs: StaleItem[] = [];

  // ── stale deals ───────────────────────────────────────────
  try {
    const { data: deals } = await queryDeals({}, { pageSize: 100 });
    const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");

    for (const deal of openDeals) {
      const age = daysAgo(deal.lastEditedTime);
      if (age >= STALE_DEAL_DAYS) {
        staleDeals.push({
          name: deal.deal,
          detail: `stage: ${deal.stage}`,
          daysAgo: age,
        });
      }
    }
  } catch (err) {
    console.error("[relationship-alerts] deals query failed:", err);
  }

  // ── cold relationships ────────────────────────────────────
  try {
    const { data: orgs } = await queryOrganizations(
      { outreachStatus: ["Contacted", "In conversation", "Proposal sent"] },
      { pageSize: MAX_ORGS_TO_CHECK },
    );

    const activityChecks = await Promise.allSettled(
      orgs.map(async (org) => {
        const { data: activities } = await getActivitiesForOrg(org.id);
        const mostRecent = activities[0];
        const lastDate = mostRecent?.date?.start ?? mostRecent?.createdTime ?? null;
        const age = lastDate ? daysAgo(lastDate) : 999;
        return { org, age };
      }),
    );

    for (const result of activityChecks) {
      if (result.status !== "fulfilled") continue;
      const { org, age } = result.value;
      if (age >= COLD_ORG_DAYS) {
        coldOrgs.push({
          name: org.organization,
          detail: org.outreachStatus,
          daysAgo: age === 999 ? -1 : age,
        });
      }
    }
  } catch (err) {
    console.error("[relationship-alerts] orgs query failed:", err);
  }

  // ── nothing to report ─────────────────────────────────────
  if (staleDeals.length === 0 && coldOrgs.length === 0) {
    return NextResponse.json({ message: "all clear — nothing stale today" });
  }

  // ── Claude digest ─────────────────────────────────────────
  let digest = "";
  try {
    const dealLines = staleDeals
      .map((d) => `- ${d.name} (${d.detail}) — ${d.daysAgo} days no movement`)
      .join("\n");
    const orgLines = coldOrgs
      .map((o) => `- ${o.name} (${o.detail}) — ${o.daysAgo === -1 ? "no activity on record" : `${o.daysAgo} days since last contact`}`)
      .join("\n");

    const result = await callClaude({
      feature: "relationship-score",
      system: "You write concise, actionable port health summaries for a small learning design consultancy. Be direct, practical, and warm. 3-5 bullet points max. No headers.",
      userMessage: `Write a brief action-oriented summary for this port health check. Focus on what the team should do TODAY.\n\nStale deals (no movement in 14+ days):\n${dealLines || "none"}\n\nCold relationships (no contact in 21+ days):\n${orgLines || "none"}`,
      userId: "cron",
      maxTokens: 300,
      temperature: 0.3,
    });
    digest = result.text;
  } catch {
    // fallback to raw list if Claude fails
    digest = "";
  }

  // ── format Slack message ──────────────────────────────────
  const parts: string[] = ["*🔔 Daily Port Health Check*\n"];

  if (staleDeals.length > 0) {
    parts.push(`*Stale Deals (${STALE_DEAL_DAYS}+ days no movement):*`);
    parts.push(...staleDeals.map((d) => `• ${d.name} — ${d.detail} — ${d.daysAgo}d`));
  }

  if (coldOrgs.length > 0) {
    parts.push(`\n*Cold Relationships (${COLD_ORG_DAYS}+ days no contact):*`);
    parts.push(
      ...coldOrgs.map((o) =>
        `• ${o.name} — ${o.detail} — ${o.daysAgo === -1 ? "no activity" : `${o.daysAgo}d`}`,
      ),
    );
  }

  if (digest) {
    parts.push(`\n*AI Digest:*\n${digest}`);
  }

  parts.push("\n_Review at port.windedvertigo.com_");

  await postToSlack(parts.join("\n"));

  return NextResponse.json({
    message: "alerts sent",
    staleDeals: staleDeals.length,
    coldOrgs: coldOrgs.length,
  });
}
