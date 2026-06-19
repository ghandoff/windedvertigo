/**
 * campaigns-tab.tsx — 6 campaign architecture cards.
 *
 * Lifts the existing campaign-cards JSX from page.tsx, with the addition of
 * `?member=` filtering: when a team member is active in the pulse strip,
 * only campaigns where they're listed as an owner are shown.
 *
 * Cards are CRM-linked: matchKeywords fuzzy-match against existing port
 * campaigns. Cards with matches link to the campaign; cards with no match
 * show a "create with claude" button.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Megaphone,
  Users,
  Calendar,
  FileText,
  RotateCcw,
  Target,
} from "lucide-react";
import { CAMPAIGNS, matchCrmCampaigns } from "@/lib/strategy-data";
import { CreateWithClaudeButton } from "../create-with-claude-button";
import type { EmailAnalytics } from "@/lib/marketing/rfp-analytics";

const ICON_MAP = {
  Mail,
  Megaphone,
  Users,
  Calendar,
  FileText,
  RotateCcw,
} as const;

export interface CampaignsTabProps {
  crmCampaigns: { id: string; name: string; status: string }[];
  memberFilter: string | null;
  emailAnalytics?: EmailAnalytics | null;
}

export function CampaignsTab({ crmCampaigns, memberFilter, emailAnalytics }: CampaignsTabProps) {
  const visible = memberFilter
    ? CAMPAIGNS.filter((c) => c.ownerNames.includes(memberFilter))
    : CAMPAIGNS;

  return (
    <div className="space-y-4">
      {/* email performance strip */}
      {emailAnalytics && <EmailPerformance data={emailAnalytics} />}

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[#273248]">
          campaign architecture
          {memberFilter && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              · filtered to {memberFilter} ({visible.length} of {CAMPAIGNS.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-8 text-center">
            no campaigns owned by {memberFilter}. clear the filter to see all.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visible.map((campaign) => {
              const Icon = ICON_MAP[campaign.iconName];
              const matches = matchCrmCampaigns(
                campaign.matchKeywords,
                crmCampaigns,
              );
              const primaryHref =
                matches.length === 1
                  ? `/campaigns/${matches[0].id}`
                  : `/campaigns?search=${encodeURIComponent(campaign.matchKeywords[0] ?? campaign.name)}`;
              const liveCount = matches.filter((m) => m.status === "active").length;

              return (
                <Link
                  key={campaign.id}
                  href={primaryHref}
                  className="group rounded-lg border border-border bg-card p-4 space-y-3 hover:shadow-md hover:border-[#b15043]/40 transition-all block"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 rounded-md bg-muted p-2 group-hover:bg-[#b15043]/10 transition-colors">
                      <Icon className="h-4 w-4 text-[#273248] group-hover:text-[#b15043] transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">
                          {campaign.name}
                        </p>
                        {matches.length > 0 ? (
                          <Badge
                            variant="outline"
                            className={`text-[9px] tabular-nums shrink-0 ${
                              liveCount > 0
                                ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                : "border-amber-300 text-amber-700 bg-amber-50"
                            }`}
                          >
                            {matches.length} crm
                            {liveCount > 0 ? ` · ${liveCount} active` : ""}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] shrink-0 border-muted-foreground/30 text-muted-foreground"
                          >
                            no crm match
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {campaign.objective}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {campaign.keyMetrics.map((m) => (
                      <div
                        key={m}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <Target className="h-3 w-3 shrink-0 text-[#b15043]" />
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-1 border-t border-border flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground">
                        owner:{" "}
                      </span>
                      <span className="text-[10px] font-medium">
                        {campaign.ownerLabel}
                      </span>
                    </div>
                    {matches.length === 0 ? (
                      <CreateWithClaudeButton
                        strategicName={campaign.name}
                        objective={campaign.objective}
                        keyMetrics={campaign.keyMetrics}
                        owner={campaign.ownerLabel}
                        matchKeywords={campaign.matchKeywords}
                      />
                    ) : (
                      <span className="text-[10px] text-[#b15043] opacity-0 group-hover:opacity-100 transition-opacity">
                        open in crm →
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-4 italic">
          cards link to matching campaigns in the crm. badge shows how many
          existing crm campaigns match the strategic intent — create new ones
          if "no crm match".
        </p>
      </CardContent>
    </Card>
    </div>
  );
}

// ── Email performance section ─────────────────────────────────────────

function EmailPerformance({ data }: { data: EmailAnalytics }) {
  const openRateColor =
    data.openRate >= 30 ? "text-green-600" : data.openRate >= 15 ? "text-amber-600" : "text-muted-foreground";
  const clickRateColor =
    data.clickRate >= 5 ? "text-green-600" : data.clickRate >= 2 ? "text-amber-600" : "text-muted-foreground";

  const maxSent = Math.max(...data.monthlyTrend.map((d) => d.sent), 1);

  return (
    <div className="space-y-4">
      {/* stat strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className="text-xl font-bold tabular-nums">{data.sent.toLocaleString()}</span>
          <span className="text-[11px] text-muted-foreground">emails sent</span>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className={`text-xl font-bold tabular-nums ${openRateColor}`}>{data.openRate}%</span>
          <span className="text-[11px] text-muted-foreground">avg open rate</span>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className={`text-xl font-bold tabular-nums ${clickRateColor}`}>{data.clickRate}%</span>
          <span className="text-[11px] text-muted-foreground">avg click rate</span>
        </div>
      </div>

      {/* 6-month trend */}
      <div className="rounded-lg border border-border bg-card px-4 py-4">
        <h3 className="text-xs font-medium text-muted-foreground mb-4">email trend — last 6 months</h3>

        {/* legend */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/70" />
            sent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500/70" />
            opens
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/70" />
            clicks
          </span>
        </div>

        <div className="space-y-2">
          {data.monthlyTrend.map(({ month, sent, opens, clicks }) => {
            const sentPct   = Math.round((sent   / maxSent) * 100);
            const opensPct  = sent > 0 ? Math.round((opens  / sent) * 100) : 0;
            const clicksPct = sent > 0 ? Math.round((clicks / sent) * 100) : 0;
            return (
              <div key={month} className="grid grid-cols-[56px_1fr] items-center gap-3">
                <span className="text-[11px] text-muted-foreground text-right shrink-0">{month}</span>
                <div className="flex flex-col gap-0.5">
                  <div className="h-3 rounded-sm bg-muted overflow-hidden">
                    <div className="h-full rounded-sm bg-primary/70 transition-all" style={{ width: `${sentPct}%` }} title={`${sent} sent`} />
                  </div>
                  <div className="h-2 rounded-sm bg-muted overflow-hidden">
                    <div className="h-full rounded-sm bg-green-500/70 transition-all" style={{ width: `${opensPct}%` }} title={`${opens} opens (${opensPct}%)`} />
                  </div>
                  <div className="h-2 rounded-sm bg-muted overflow-hidden">
                    <div className="h-full rounded-sm bg-amber-500/70 transition-all" style={{ width: `${clicksPct}%` }} title={`${clicks} clicks (${clicksPct}%)`} />
                  </div>
                </div>
              </div>
            );
          })}
          {data.monthlyTrend.every((d) => d.sent === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">no sent emails in the last 6 months</p>
          )}
        </div>
      </div>
    </div>
  );
}
