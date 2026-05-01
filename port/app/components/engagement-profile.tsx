/**
 * Engagement profile — campaign-grouped email history with machine/human
 * open discrimination, click-through tracking, and engagement scoring.
 *
 * Server component that fetches campaign names and renders the full profile
 * on the org detail page.
 */

import Link from "next/link";
import { Eye, EyeOff, MousePointerClick, Bot, AlertTriangle, BarChart3, Mail, User } from "lucide-react";
import { getCampaign } from "@/lib/notion/campaigns";
import { getContact } from "@/lib/notion/contacts";
import type { EmailDraft, Campaign } from "@/lib/notion/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ── engagement scoring ───────────────────────────────────────

type EngagementLevel = "champion" | "active" | "warm" | "aware" | "silent" | "none";

function computeEngagementLevel(drafts: EmailDraft[]): EngagementLevel {
  if (drafts.length === 0) return "none";

  const hasClicks = drafts.some((d) => d.clicks > 0);
  const hasHumanOpens = drafts.some((d) => d.opens > 0);
  const hasMachineOpens = drafts.some((d) => d.machineOpens > 0);
  const multipleOpens = drafts.filter((d) => d.opens > 0).length > 1;

  if (hasClicks) return "champion";
  if (multipleOpens) return "active";
  if (hasHumanOpens) return "warm";
  if (hasMachineOpens) return "aware";
  return "silent";
}

const ENGAGEMENT_META: Record<EngagementLevel, { label: string; color: string; icon: string }> = {
  champion: { label: "champion", color: "text-blue-600 bg-blue-50 border-blue-200", icon: "🏆" },
  active: { label: "active", color: "text-green-600 bg-green-50 border-green-200", icon: "🟢" },
  warm: { label: "warm", color: "text-amber-600 bg-amber-50 border-amber-200", icon: "🟡" },
  aware: { label: "aware", color: "text-orange-500 bg-orange-50 border-orange-200", icon: "🟠" },
  silent: { label: "silent", color: "text-gray-500 bg-gray-50 border-gray-200", icon: "⚪" },
  none: { label: "no emails", color: "text-gray-400 bg-gray-50 border-gray-200", icon: "—" },
};

// ── engagement type per draft ────────────────────────────────

function classifyDraft(draft: EmailDraft): {
  label: string;
  Icon: typeof Eye;
  color: string;
} {
  if (draft.status === "failed") {
    return { label: "bounced", Icon: AlertTriangle, color: "text-red-500" };
  }
  if (draft.clicks > 0) {
    return { label: "clicked", Icon: MousePointerClick, color: "text-blue-600" };
  }
  if (draft.opens > 0) {
    return { label: "opened", Icon: Eye, color: "text-green-600" };
  }
  if (draft.machineOpens > 0) {
    return { label: "machine only", Icon: Bot, color: "text-amber-500" };
  }
  return { label: "no signal", Icon: EyeOff, color: "text-muted-foreground" };
}

// ── campaign group ───────────────────────────────────────────

interface CampaignGroup {
  campaignId: string;
  campaign: Campaign | null;
  drafts: EmailDraft[];
}

// ── component ────────────────────────────────────────────────

interface EngagementProfileProps {
  /** Sent drafts only (status === "sent") */
  drafts: EmailDraft[];
  /** All drafts including failed — for engagement scoring */
  allDrafts: EmailDraft[];
  orgId: string;
}

export async function EngagementProfile({ drafts, allDrafts, orgId }: EngagementProfileProps) {
  // Compute engagement level from sent drafts
  const level = computeEngagementLevel(drafts);
  const meta = ENGAGEMENT_META[level];

  // Aggregate stats
  const totalSent = drafts.length;
  const totalFailed = allDrafts.filter((d) => d.status === "failed").length;
  const humanOpened = drafts.filter((d) => d.opens > 0).length;
  const machineOnly = drafts.filter((d) => d.opens === 0 && d.machineOpens > 0).length;
  const clicked = drafts.filter((d) => d.clicks > 0).length;
  const openRate = totalSent > 0 ? Math.round((humanOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0;

  // Group drafts by campaign
  const campaignIds = [...new Set(allDrafts.map((d) => d.campaignId).filter(Boolean))] as string[];
  const campaignMap = new Map<string, Campaign>();
  if (campaignIds.length > 0) {
    const results = await Promise.all(
      campaignIds.map(async (cid) => {
        try {
          const c = await getCampaign(cid);
          return [cid, c] as const;
        } catch {
          return [cid, null] as const;
        }
      }),
    );
    for (const [cid, c] of results) {
      if (c) campaignMap.set(cid, c);
    }
  }

  // Resolve contact names for drafts with contactId
  const uniqueContactIds = [...new Set(allDrafts.map((d) => d.contactId).filter(Boolean))] as string[];
  const contactNameMap = new Map<string, string>();
  if (uniqueContactIds.length > 0) {
    const cResults = await Promise.all(
      uniqueContactIds.map(async (cid) => {
        try {
          const c = await getContact(cid);
          return [cid, c.name] as const;
        } catch {
          return [cid, null] as const;
        }
      }),
    );
    for (const [cid, name] of cResults) {
      if (name) contactNameMap.set(cid, name);
    }
  }

  const groups: CampaignGroup[] = campaignIds.map((cid) => ({
    campaignId: cid,
    campaign: campaignMap.get(cid) ?? null,
    drafts: allDrafts.filter((d) => d.campaignId === cid),
  }));

  // Ad-hoc emails (no campaign)
  const adHocDrafts = allDrafts.filter((d) => !d.campaignId);

  // Sort groups: most recent first
  groups.sort((a, b) => {
    const aDate = a.drafts[0]?.sentAt ?? a.drafts[0]?.createdTime ?? "";
    const bDate = b.drafts[0]?.sentAt ?? b.drafts[0]?.createdTime ?? "";
    return bDate.localeCompare(aDate);
  });

  if (allDrafts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">engagement profile</CardTitle>
          <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
            {meta.icon} {meta.label}
          </Badge>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{totalSent} sent</span>
          {totalFailed > 0 && <span className="text-red-500">{totalFailed} failed</span>}
          <span className={openRate > 0 ? "text-green-600 font-medium" : ""}>
            {openRate}% open
          </span>
          {machineOnly > 0 && (
            <span className="text-amber-500" title="machine opens only (no human open detected)">
              +{machineOnly} machine
            </span>
          )}
          <span className={clickRate > 0 ? "text-blue-600 font-medium" : ""}>
            {clickRate}% click
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Campaign-grouped emails */}
        {groups.map((group, gi) => {
          const sentInGroup = group.drafts.filter((d) => d.status === "sent");
          const groupOpened = sentInGroup.filter((d) => d.opens > 0).length;
          const groupClicked = sentInGroup.filter((d) => d.clicks > 0).length;
          const groupMachine = sentInGroup.filter((d) => d.opens === 0 && d.machineOpens > 0).length;

          return (
            <div key={group.campaignId}>
              {gi > 0 && <Separator />}
              {/* Campaign header */}
              <div className="px-6 py-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    {group.campaign ? (
                      <Link
                        href={`/campaigns/${group.campaignId}/recipients`}
                        className="text-sm font-medium hover:underline"
                      >
                        {group.campaign.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">
                        unknown campaign
                      </span>
                    )}
                    {group.campaign?.status && (
                      <Badge variant="outline" className="text-[9px] h-4">
                        {group.campaign.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    <span>{sentInGroup.length} sent</span>
                    {groupOpened > 0 && <span className="text-green-600">{groupOpened} opened</span>}
                    {groupMachine > 0 && <span className="text-amber-500">{groupMachine} machine</span>}
                    {groupClicked > 0 && <span className="text-blue-600">{groupClicked} clicked</span>}
                  </div>
                </div>
              </div>

              {/* Emails in campaign */}
              <div className="divide-y text-sm">
                {group.drafts.map((draft) => (
                  <DraftRow key={draft.id} draft={draft} contactNameMap={contactNameMap} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Ad-hoc emails (no campaign) */}
        {adHocDrafts.length > 0 && (
          <>
            {groups.length > 0 && <Separator />}
            <div className="px-6 py-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  ad hoc emails
                </span>
              </div>
            </div>
            <div className="divide-y text-sm">
              {adHocDrafts.map((draft) => (
                <DraftRow key={draft.id} draft={draft} contactNameMap={contactNameMap} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── draft row ────────────────────────────────────────────────

function DraftRow({ draft, contactNameMap }: { draft: EmailDraft; contactNameMap: Map<string, string> }) {
  const { label, Icon, color } = classifyDraft(draft);
  const isSent = draft.status === "sent";
  const contactName = draft.contactId ? contactNameMap.get(draft.contactId) : undefined;

  return (
    <div className={`px-6 py-3 flex items-start justify-between gap-4 ${draft.status === "failed" ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{draft.subject}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {draft.sentAt && (
            <p className="text-xs text-muted-foreground">
              {new Date(draft.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
          {(contactName || draft.sentTo) && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              {contactName && (
                <>
                  <User className="h-2.5 w-2.5" />
                  <span>{contactName}</span>
                  <span className="mx-0.5">·</span>
                </>
              )}
              {draft.sentTo && <span>{draft.sentTo}</span>}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Engagement icon + label */}
        <div className={`flex items-center gap-1 text-[10px] ${color}`}>
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </div>

        {/* Detail badges */}
        {isSent && draft.opens > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-green-50 text-green-700 border-green-200">
            {draft.opens > 1 ? `×${draft.opens}` : "1"} open{draft.opens !== 1 ? "s" : ""}
          </Badge>
        )}
        {isSent && draft.machineOpens > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-amber-50 text-amber-600 border-amber-200" title="machine/bot opens (Apple MPP, security scanners)">
            {draft.machineOpens} bot
          </Badge>
        )}
        {isSent && draft.clicks > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-blue-50 text-blue-600 border-blue-200">
            {draft.clicks} click{draft.clicks !== 1 ? "s" : ""}
          </Badge>
        )}
        {draft.status === "failed" && (
          <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-red-50 text-red-700 border-red-200">
            {draft.status}
          </Badge>
        )}
      </div>
    </div>
  );
}
