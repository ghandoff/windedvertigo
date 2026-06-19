"use client";

/**
 * kpi-source-modal.tsx — click any KPI tile in the pipeline tab to open
 * a modal showing exactly where that number comes from. Phase 1 follow-up
 * to Prompt 1: make every "0" or "156" auditable so the team knows what's
 * wired vs not.
 *
 * Each KPI card maps to a `kind` here, and the modal renders a per-source
 * breakdown table. NULL values are shown as "not wired yet · plan: …" with
 * a deep-link to social-media-integration-plan.md.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Info, Mail, Heart, Users, TrendingUp, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { fmt, pct } from "@/lib/strategy-data";
import {
  UpdateMetricButton,
  type SupportedPlatform,
} from "./social-metrics-form";

// ── source metadata ────────────────────────────────────────────────────

type WireStatus = "wired" | "stale" | "not-wired";

interface SourceRow {
  platform: string;
  value: number | null;
  status: WireStatus;
  note?: string;
  /** anchor in social-media-integration-plan.md (heading slug) */
  planAnchor?: string;
  /** if set, the row gets an "enter weekly count →" button that opens the
   *  SocialMetricsForm scoped to this platform. omit for first-party
   *  data sources (port email) where manual entry doesn't make sense. */
  manualEntryPlatform?: SupportedPlatform;
  /** weekly vs monthly cadence — drives the button copy */
  manualEntryCadence?: "weekly" | "monthly";
}

// readable status pill
function StatusPill({ status }: { status: WireStatus }) {
  const cls = {
    wired:
      "border-emerald-300 text-emerald-700 bg-emerald-50",
    stale:
      "border-amber-300 text-amber-700 bg-amber-50",
    "not-wired":
      "border-red-300 text-red-700 bg-red-50",
  }[status];
  const Icon = status === "wired" ? CheckCircle2 : AlertCircle;
  const label = {
    wired: "live",
    stale: "stale",
    "not-wired": "not wired",
  }[status];
  return (
    <Badge
      variant="outline"
      className={`text-[9px] tabular-nums uppercase tracking-wider ${cls}`}
    >
      <Icon className="h-2.5 w-2.5 mr-0.5" />
      {label}
    </Badge>
  );
}

// ── shape stats input ──────────────────────────────────────────────────

interface NormalizedStats {
  substack?: { totalSubscribers: number | null } | null;
  meta?: {
    instagramFollowers: number | null;
    facebookPageFollowers: number | null;
    instagramRecentEngagement?: number | null;
    facebookRecentEngagement?: number | null;
  } | null;
  linkedin?: {
    followerCount: number | null;
    recentPostEngagement?: number | null;
  } | null;
  bluesky?: {
    followerCount: number | null;
    recentPostEngagement?: number | null;
  } | null;
  port?: {
    uniqueRecipients?: number;
    totalEmailsSent?: number;
    totalOpens?: number;
    totalClicks?: number;
  } | null;
  generatedAt: string | null;
}

export type KpiKind =
  | "substack-subscribers"
  | "social-followers"
  | "harbour-signups"
  | "campaign-reach";

// ── per-kind detail builders ───────────────────────────────────────────

function detailsFor(kind: KpiKind, stats: NormalizedStats | null): {
  title: string;
  oneLineDescription: string;
  sources: SourceRow[];
  /** sum or composite value the tile shows */
  totalLabel: string;
  totalValue: string;
  target?: { label: string; value: number };
  formula: string;
} {
  switch (kind) {
    case "substack-subscribers": {
      const subs = stats?.substack?.totalSubscribers ?? null;
      return {
        title: "substack subscribers",
        oneLineDescription:
          "total subscribers to windedvertigo.substack.com — direct-to-reader email list.",
        sources: [
          {
            platform: "substack",
            value: subs,
            status: subs == null ? "not-wired" : "wired",
            note:
              subs == null
                ? "substack has no public api — manual monthly entry is the recommended phase 1 path"
                : undefined,
            planAnchor: "substack",
            manualEntryPlatform: "substack",
            manualEntryCadence: "monthly",
          },
        ],
        totalLabel: "current",
        totalValue: subs == null ? "0" : fmt(subs),
        target: { label: "target by sept", value: 2000 },
        formula: "substack.totalSubscribers (direct field — no aggregation)",
      };
    }
    case "social-followers": {
      const port = stats?.port;
      const meta = stats?.meta;
      const li = stats?.linkedin;
      const bsky = stats?.bluesky;
      const sub = stats?.substack;
      const portEmail = port?.uniqueRecipients ?? 0;
      const sources: SourceRow[] = [
        {
          platform: "port email recipients",
          value: portEmail,
          status: "wired",
          note:
            "first-party email-list size — number of unique recipients across port email campaigns. this dominates the total today.",
        },
        {
          platform: "bluesky",
          value: bsky?.followerCount ?? null,
          status: bsky?.followerCount != null ? "wired" : "not-wired",
          note: "windedvertigo.bsky.social · synced via at protocol api",
          planAnchor: "bluesky",
          manualEntryPlatform: "bluesky",
          manualEntryCadence: "weekly",
        },
        {
          platform: "instagram",
          value: meta?.instagramFollowers ?? null,
          status: meta?.instagramFollowers != null ? "wired" : "not-wired",
          note:
            "instagram.com/winded.vertigo · business account at comms@windedvertigo.com · phase 1 manual entry, phase 2 graph api",
          planAnchor: "instagram--facebook-meta",
          manualEntryPlatform: "instagram",
          manualEntryCadence: "weekly",
        },
        {
          platform: "facebook page",
          value: meta?.facebookPageFollowers ?? null,
          status: meta?.facebookPageFollowers != null ? "wired" : "not-wired",
          planAnchor: "instagram--facebook-meta",
          manualEntryPlatform: "facebook",
          manualEntryCadence: "weekly",
        },
        {
          platform: "linkedin company page",
          value: li?.followerCount ?? null,
          status: li?.followerCount != null ? "wired" : "not-wired",
          note:
            "linkedin/company/winded-vertigo · payton has admin · phase 1 weekly csv-style entry, phase 2 community management api",
          planAnchor: "linkedin",
          manualEntryPlatform: "linkedin",
          manualEntryCadence: "weekly",
        },
        {
          platform: "substack subscribers",
          value: sub?.totalSubscribers ?? null,
          status: sub?.totalSubscribers != null ? "wired" : "not-wired",
          note: "(also rolls up to the substack-subscribers tile)",
          planAnchor: "substack",
          manualEntryPlatform: "substack",
          manualEntryCadence: "monthly",
        },
      ];
      const total = sources.reduce(
        (sum, s) => sum + (typeof s.value === "number" ? s.value : 0),
        0,
      );
      return {
        title: "social followers (aggregate)",
        oneLineDescription:
          "sum of follower counts across every reachable channel. today this is dominated by the port email list because most platform integrations aren't wired yet — see the per-platform table below.",
        sources,
        totalLabel: "current",
        totalValue: fmt(total),
        target: { label: "target", value: 5000 },
        formula:
          "port.uniqueRecipients + bluesky + instagram + facebook + linkedin + substack",
      };
    }
    case "harbour-signups": {
      return {
        title: "harbour signups",
        oneLineDescription:
          "total educator signups to harbour after the may 28 launch.",
        sources: [
          {
            platform: "harbour signup form",
            value: 0,
            status: "not-wired",
            note:
              "harbour launches may 28; the supabase table for signups exists but no rows yet. once launch fires, the count populates automatically.",
          },
        ],
        totalLabel: "current",
        totalValue: "0",
        target: { label: "target by week 1", value: 800 },
        formula:
          "count(*) from harbour_signups (placeholder — wires on launch day)",
      };
    }
    case "campaign-reach": {
      const port = stats?.port;
      const sent = port?.totalEmailsSent ?? 0;
      const opens = port?.totalOpens ?? 0;
      const clicks = port?.totalClicks ?? 0;
      return {
        title: "campaign reach (port email)",
        oneLineDescription:
          "total emails sent through port + engagement events (opens + clicks). first-party data from resend webhooks.",
        sources: [
          {
            platform: "port email sends",
            value: sent,
            status: "wired",
            note:
              "from `email_drafts` + resend delivery records. updated every 6 hours by the sync-email-drafts-pilot cron.",
          },
          {
            platform: "port email opens",
            value: opens,
            status: "wired",
            note: "open events captured by resend webhook",
          },
          {
            platform: "port email clicks",
            value: clicks,
            status: "wired",
          },
        ],
        totalLabel: "emails sent",
        totalValue: fmt(sent),
        target: { label: "target through q3", value: 100 },
        formula:
          "port.totalEmailsSent (label) + opens + clicks shown alongside",
      };
    }
  }
}

// ── modal ──────────────────────────────────────────────────────────────

export function KpiSourceModal({
  kind,
  stats,
  open,
  onOpenChange,
}: {
  kind: KpiKind;
  stats: NormalizedStats | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const detail = detailsFor(kind, stats);
  const lastSynced = stats?.generatedAt;
  const lastSyncedFmt = lastSynced
    ? new Date(lastSynced).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).toLowerCase()
    : "never";

  const wiredCount = detail.sources.filter((s) => s.status === "wired").length;
  const totalSources = detail.sources.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-[#b15043]" />
            {detail.title}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {detail.oneLineDescription}
          </DialogDescription>
        </DialogHeader>

        {/* total + target + sync */}
        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {detail.totalLabel}
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#273248] mt-0.5">
              {detail.totalValue}
            </p>
            {detail.target && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {pct(
                  Number(detail.totalValue.replace(/,/g, "")) || 0,
                  detail.target.value,
                )}
                % of {fmt(detail.target.value)}
              </p>
            )}
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              source coverage
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#273248] mt-0.5">
              {wiredCount}
              <span className="text-base text-muted-foreground"> / {totalSources}</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              platforms wired
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              last sync
            </p>
            <p className="text-sm font-medium text-[#273248] mt-0.5">
              {lastSyncedFmt}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {lastSynced ? "via sync-social-stats cron" : "no snapshot found"}
            </p>
          </div>
        </div>

        {/* per-source breakdown */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            per-platform breakdown
          </p>
          <div className="rounded-md border divide-y">
            {detail.sources.map((s) => (
              <div
                key={s.platform}
                className="flex items-start gap-3 p-3 text-xs"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{s.platform}</span>
                    <StatusPill status={s.status} />
                    <span className="ml-auto tabular-nums font-medium text-[#273248]">
                      {s.value == null ? "—" : fmt(s.value)}
                    </span>
                  </div>
                  {s.note && (
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {s.note}
                    </p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    {s.manualEntryPlatform && s.manualEntryCadence && (
                      <UpdateMetricButton
                        platform={s.manualEntryPlatform}
                        cadence={s.manualEntryCadence}
                      />
                    )}
                    {s.status === "not-wired" && s.planAnchor && (
                      <a
                        href={`/docs/social-media-integration-plan#${s.planAnchor}`}
                        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-0.5"
                      >
                        see integration plan{" "}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* formula */}
        <div className="text-[10px] text-muted-foreground pt-1 border-t font-mono leading-relaxed">
          <span className="uppercase tracking-wider not-italic mr-2">
            formula:
          </span>
          {detail.formula}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── clickable wrapper for the existing KpiCard pattern ────────────────

export function ClickableKpiCard({
  kind,
  stats,
  children,
}: {
  kind: KpiKind;
  stats: NormalizedStats | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left w-full hover:shadow-sm transition-shadow rounded-lg"
        title="click to inspect data sources"
      >
        {children}
      </button>
      <KpiSourceModal
        kind={kind}
        stats={stats}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

// re-export icon helpers for parent use
export const KPI_ICONS = { Mail, Heart, Users, TrendingUp } as const;
