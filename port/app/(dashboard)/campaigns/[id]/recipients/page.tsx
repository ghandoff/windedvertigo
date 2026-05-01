import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, MousePointerClick, Bot, Mail, AlertTriangle } from "lucide-react";
import { getCampaign } from "@/lib/notion/campaigns";
import { queryEmailDraftsByCampaign } from "@/lib/notion/email-drafts";
import { getOrganization } from "@/lib/notion/organizations";
import { getContact } from "@/lib/notion/contacts";
import { resolveAudience } from "@/lib/notion/audience";
import { PageHeader } from "@/app/components/page-header";
import { UpcomingRecipients } from "@/app/components/upcoming-recipients";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  stranger: "bg-gray-100 text-gray-700",
  aware: "bg-blue-100 text-blue-700",
  contacted: "bg-indigo-100 text-indigo-700",
  "in conversation": "bg-purple-100 text-purple-700",
  collaborating: "bg-green-100 text-green-700",
  "active partner": "bg-emerald-100 text-emerald-700",
  champion: "bg-amber-100 text-amber-700",
};

const FIT_LABELS: Record<string, string> = {
  "\ud83d\udd25 Perfect fit": "\ud83d\udd25",
  "\u2705 Strong fit": "\u2705",
  "\ud83d\udfe1 Moderate fit": "\ud83d\udfe1",
  "\ud83d\udfe0 Weak fit": "\ud83d\udfe0",
  "\u274c No fit": "\u274c",
};

interface RecipientRow {
  draftId: string;
  orgId: string;
  orgName: string;
  relationship: string;
  fitRating: string;
  status: string;
  sentAt: string | null;
  opens: number;
  clicks: number;
  machineOpens: number;
  /** Actual email address the draft was delivered to */
  sentTo: string;
  /** Contact name (if sent to a specific contact vs org overview email) */
  contactName: string | null;
  /** Whether this was a contact fan-out vs org-email fallback */
  recipientType: "contact" | "org" | "unknown";
}

export default async function CampaignRecipientsPage({ params }: Props) {
  const { id } = await params;

  let campaign;
  try {
    campaign = await getCampaign(id);
  } catch {
    notFound();
  }

  const drafts = await queryEmailDraftsByCampaign(id);

  // Collect unique org IDs and batch-fetch
  const uniqueOrgIds = [...new Set(drafts.map((d) => d.organizationId).filter(Boolean))];
  const orgMap = new Map<string, { name: string; relationship: string; fitRating: string; email: string }>();

  for (let i = 0; i < uniqueOrgIds.length; i += 10) {
    const batch = uniqueOrgIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (orgId) => {
        try {
          const org = await getOrganization(orgId);
          return { id: orgId, name: org.organization, relationship: org.relationship, fitRating: org.fitRating, email: org.email };
        } catch {
          return { id: orgId, name: "[unknown]", relationship: "", fitRating: "", email: "" };
        }
      }),
    );
    for (const r of results) {
      orgMap.set(r.id, { name: r.name, relationship: r.relationship, fitRating: r.fitRating, email: r.email });
    }
  }

  // Batch-fetch contact names for drafts that have a contactId
  const uniqueContactIds = [...new Set(drafts.map((d) => d.contactId).filter(Boolean))] as string[];
  const contactNameMap = new Map<string, string>();
  for (let i = 0; i < uniqueContactIds.length; i += 10) {
    const batch = uniqueContactIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (cid) => {
        try {
          const c = await getContact(cid);
          return { id: cid, name: c.name };
        } catch {
          return { id: cid, name: null };
        }
      }),
    );
    for (const r of results) {
      if (r.name) contactNameMap.set(r.id, r.name);
    }
  }

  const recipients: RecipientRow[] = drafts.map((d) => {
    const org = orgMap.get(d.organizationId);
    const contactName = d.contactId ? (contactNameMap.get(d.contactId) ?? null) : null;
    // Determine recipient type: if draft has a contactId it was a contact fan-out;
    // if it has sentTo but no contactId, it was an org-email fallback;
    // if neither is populated (legacy drafts), mark as unknown.
    const recipientType: "contact" | "org" | "unknown" = d.contactId
      ? "contact"
      : d.sentTo
        ? "org"
        : "unknown";

    return {
      draftId: d.id,
      orgId: d.organizationId,
      orgName: org?.name ?? "[unknown]",
      relationship: org?.relationship ?? "",
      fitRating: org?.fitRating ?? "",
      status: d.status,
      sentAt: d.sentAt,
      opens: d.opens,
      clicks: d.clicks,
      machineOpens: d.machineOpens,
      sentTo: d.sentTo || org?.email || "",
      contactName,
      recipientType,
    };
  });

  const sent = recipients.filter((r) => r.status === "sent");
  const failed = recipients.filter((r) => r.status === "failed");
  const humanOpened = sent.filter((r) => r.opens > 0);
  const machineOnly = sent.filter((r) => r.opens === 0 && r.machineOpens > 0);
  const noOpens = sent.filter((r) => r.opens === 0 && r.machineOpens === 0);
  const clicked = sent.filter((r) => r.clicks > 0);

  // Resolve current audience to find who HASN'T been contacted yet
  const hasFilters = campaign.audienceFilters && Object.keys(campaign.audienceFilters).length > 0;
  const currentAudience = hasFilters ? await resolveAudience(campaign.audienceFilters) : [];
  const recipientOrgIds = new Set(uniqueOrgIds);
  const notYetContacted = currentAudience.filter((org) => !recipientOrgIds.has(org.id));

  // Sort: clicked first, then opened, then no engagement, then failed
  const sorted = [...recipients].sort((a, b) => {
    const scoreA = a.status === "failed" ? -10 : (a.clicks > 0 ? 3 : a.opens > 0 ? 2 : a.machineOpens > 0 ? 1 : 0);
    const scoreB = b.status === "failed" ? -10 : (b.clicks > 0 ? 3 : b.opens > 0 ? 2 : b.machineOpens > 0 ? 1 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.orgName.localeCompare(b.orgName);
  });

  return (
    <>
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to {campaign.name}
      </Link>

      <PageHeader title={`${campaign.name} — recipients`}>
        <Link
          href={`/campaigns/${id}/analytics`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          analytics
        </Link>
      </PageHeader>

      {/* audience filter criteria — transparency into WHY these orgs are in the list */}
      {campaign.audienceFilters && Object.keys(campaign.audienceFilters).length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">audience criteria:</span>
          {campaign.audienceFilters.connection && (
            <Badge variant="outline" className="text-[10px]">
              connection: {Array.isArray(campaign.audienceFilters.connection) ? campaign.audienceFilters.connection.join(", ") : campaign.audienceFilters.connection}
            </Badge>
          )}
          {campaign.audienceFilters.relationship && (
            <Badge variant="outline" className="text-[10px]">
              relationship: {Array.isArray(campaign.audienceFilters.relationship) ? campaign.audienceFilters.relationship.join(", ") : campaign.audienceFilters.relationship}
            </Badge>
          )}
          {campaign.audienceFilters.fitRating && (
            <Badge variant="outline" className="text-[10px]">
              fit: {Array.isArray(campaign.audienceFilters.fitRating) ? campaign.audienceFilters.fitRating.map((f: string) => f.split(" ")[0]).join(" ") : campaign.audienceFilters.fitRating}
            </Badge>
          )}
          {campaign.audienceFilters.source && (
            <Badge variant="outline" className="text-[10px]">
              source: {Array.isArray(campaign.audienceFilters.source) ? campaign.audienceFilters.source.join(", ") : campaign.audienceFilters.source}
            </Badge>
          )}
          {campaign.audienceFilters.marketSegment && (
            <Badge variant="outline" className="text-[10px]">
              segment: {Array.isArray(campaign.audienceFilters.marketSegment) ? campaign.audienceFilters.marketSegment.join(", ") : campaign.audienceFilters.marketSegment}
            </Badge>
          )}
          {(campaign.audienceFilters.addedOrgIds?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              +{campaign.audienceFilters.addedOrgIds!.length} manually added
            </Badge>
          )}
          {(campaign.audienceFilters.removedOrgIds?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600">
              −{campaign.audienceFilters.removedOrgIds!.length} excluded
            </Badge>
          )}
          <Link
            href={`/campaigns/${id}/edit`}
            className="text-[10px] text-accent hover:underline ml-1"
          >
            edit filters
          </Link>
        </div>
      )}

      {/* engagement summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{sent.length}</p>
            <p className="text-[10px] text-muted-foreground">sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-red-500">{failed.length}</p>
            <p className="text-[10px] text-muted-foreground">failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-green-600">{humanOpened.length}</p>
            <p className="text-[10px] text-muted-foreground">human opens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-amber-600">{machineOnly.length}</p>
            <p className="text-[10px] text-muted-foreground">machine only</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-muted-foreground">{noOpens.length}</p>
            <p className="text-[10px] text-muted-foreground">no opens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{clicked.length}</p>
            <p className="text-[10px] text-muted-foreground">clicked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-purple-600">{notYetContacted.length}</p>
            <p className="text-[10px] text-muted-foreground">remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* recipient log table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">
            recipient log
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {recipients.length} emails ({sent.length} delivered, {failed.length} failed)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>organisation</TableHead>
                <TableHead>sent to</TableHead>
                <TableHead>relationship</TableHead>
                <TableHead>fit</TableHead>
                <TableHead>status</TableHead>
                <TableHead className="text-right">opens</TableHead>
                <TableHead className="text-right">clicks</TableHead>
                <TableHead className="text-right">machine</TableHead>
                <TableHead>engagement</TableHead>
                <TableHead>sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, i) => {
                const engagement = r.status === "failed"
                  ? "failed"
                  : r.clicks > 0
                    ? "clicked"
                    : r.opens > 0
                      ? "opened"
                      : r.machineOpens > 0
                        ? "machine only"
                        : "no signal";

                const EngagementIcon = r.status === "failed"
                  ? AlertTriangle
                  : r.clicks > 0
                    ? MousePointerClick
                    : r.opens > 0
                      ? Eye
                      : r.machineOpens > 0
                        ? Bot
                        : EyeOff;

                const engagementColor = r.status === "failed"
                  ? "text-red-500"
                  : r.clicks > 0
                    ? "text-blue-600"
                    : r.opens > 0
                      ? "text-green-600"
                      : r.machineOpens > 0
                        ? "text-amber-500"
                        : "text-muted-foreground";

                return (
                  <TableRow
                    key={r.draftId}
                    className={r.status === "failed" ? "opacity-60" : ""}
                  >
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">
                      <Link
                        href={`/organizations/${r.orgId}`}
                        className="hover:underline"
                      >
                        {r.orgName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-0.5 min-w-0 max-w-[200px]">
                        {r.contactName ? (
                          <>
                            <span className="font-medium truncate">{r.contactName}</span>
                            <span className="text-muted-foreground truncate">{r.sentTo}</span>
                          </>
                        ) : r.sentTo ? (
                          <span className="text-muted-foreground truncate">{r.sentTo}</span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                        {r.recipientType === "contact" && (
                          <Badge variant="outline" className="text-[9px] h-4 w-fit bg-violet-50 text-violet-600 border-violet-200">
                            contact
                          </Badge>
                        )}
                        {r.recipientType === "org" && (
                          <Badge variant="outline" className="text-[9px] h-4 w-fit bg-slate-50 text-slate-600 border-slate-200">
                            org email
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.relationship && (
                        <Badge variant="outline" className={`text-[10px] ${RELATIONSHIP_COLORS[r.relationship] ?? ""}`}>
                          {r.relationship}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {FIT_LABELS[r.fitRating] ?? ""}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          r.status === "sent"
                            ? "bg-green-50 text-green-700"
                            : r.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : ""
                        }`}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.opens > 0 ? r.opens : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.clicks > 0 ? r.clicks : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.machineOpens > 0 ? r.machineOpens : "—"}
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1.5 text-xs ${engagementColor}`}>
                        <EngagementIcon className="h-3 w-3" />
                        {engagement}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.sentAt
                        ? new Date(r.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* "not yet contacted" panel — full interactive list with add/remove */}
      {notYetContacted.length > 0 && (
        <UpcomingRecipients
          campaignId={id}
          audienceFilters={campaign.audienceFilters ?? {}}
          orgs={notYetContacted.map((org) => ({
            id: org.id,
            organization: org.organization,
            relationship: org.relationship,
            fitRating: org.fitRating,
            email: org.email,
          }))}
        />
      )}
    </>
  );
}
