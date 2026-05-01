import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Users } from "lucide-react";
import { getCampaign } from "@/lib/notion/campaigns";
import { getStepsForCampaign } from "@/lib/notion/campaign-steps";
import { resolveAudience } from "@/lib/notion/audience";
import { getContact } from "@/lib/notion/contacts";
import type { Contact } from "@/lib/notion/types";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StepTimeline } from "@/app/components/step-timeline";
import { RecipientPanel } from "@/app/components/recipient-panel";
import { DeleteCampaignButton } from "@/app/components/delete-campaign-button";
import { EditCampaignButton } from "@/app/components/edit-campaign-button";

export const revalidate = 300;

const TYPE_COLORS: Record<string, string> = {
  "event-based": "bg-blue-100 text-blue-700 border-blue-200",
  "recurring cadence": "bg-purple-100 text-purple-700 border-purple-200",
  "one-off blast": "bg-orange-100 text-orange-700 border-orange-200",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  complete: "bg-blue-100 text-blue-700",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;

  let campaign;
  let steps;
  try {
    [campaign, steps] = await Promise.all([
      getCampaign(id),
      getStepsForCampaign(id),
    ]);
  } catch {
    notFound();
  }
  const hasFilters = campaign.audienceFilters && Object.keys(campaign.audienceFilters).length > 0;
  const allRecipients = hasFilters ? await resolveAudience(campaign.audienceFilters) : [];

  // Resolve contacts for every org that has linked contact IDs, so the
  // RecipientPanel can show the actual per-contact emails that will receive mail.
  const contactsByOrgId: Record<string, Contact[]> = {};
  const orgsWithContactIds = allRecipients.filter((o) => o.contactIds?.length > 0);
  if (orgsWithContactIds.length > 0) {
    const uniqueIds = [...new Set(orgsWithContactIds.flatMap((o) => o.contactIds))];
    const fetched = await Promise.all(uniqueIds.map((cid) => getContact(cid).catch(() => null)));
    const contactLookup = new Map<string, Contact>();
    fetched.forEach((c) => c && contactLookup.set(c.id, c));
    for (const org of orgsWithContactIds) {
      const contacts = org.contactIds.map((cid) => contactLookup.get(cid)).filter((c): c is Contact => !!c);
      if (contacts.length > 0) contactsByOrgId[org.id] = contacts;
    }
  }

  // Resolve directly-added contacts (addedContactIds in the audience filter blob)
  const { addedContactIds = [] } = campaign.audienceFilters ?? {};
  let addedContacts: Contact[] = [];
  if (addedContactIds.length > 0) {
    const fetched = await Promise.all(addedContactIds.map((cid: string) => getContact(cid).catch(() => null)));
    addedContacts = fetched.filter(Boolean) as Contact[];
  }

  const sentSteps = steps.filter((s) => s.status === "sent").length;
  const totalSteps = steps.length;

  return (
    <>
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to campaigns
      </Link>

      <PageHeader title={campaign.name}>
        <div className="flex items-center gap-2">
          <Link
            href={`/campaigns/${id}/recipients`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            recipients
          </Link>
          <Link
            href={`/campaigns/${id}/analytics`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            analytics
          </Link>
          <EditCampaignButton campaign={campaign} />
          <DeleteCampaignButton campaignId={id} campaignName={campaign.name} redirect />
          <Badge variant="outline" className={STATUS_COLORS[campaign.status] ?? ""}>
            {campaign.status}
          </Badge>
          {campaign.type && (
            <Badge variant="outline" className={`text-xs ${TYPE_COLORS[campaign.type] ?? ""}`}>
              {campaign.type}
            </Badge>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* left column — 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* campaign info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">campaign info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                {campaign.owner && (
                  <div>
                    <span className="text-muted-foreground">owner</span>
                    <p className="font-medium">{campaign.owner}</p>
                  </div>
                )}
                {campaign.startDate?.start && (
                  <div>
                    <span className="text-muted-foreground">dates</span>
                    <p className="font-medium">
                      {new Date(campaign.startDate.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {campaign.endDate?.start && ` – ${new Date(campaign.endDate.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </p>
                  </div>
                )}
              </div>
              {campaign.notes && (
                <div>
                  <span className="text-muted-foreground">notes</span>
                  <p className="font-medium whitespace-pre-wrap">{campaign.notes}</p>
                </div>
              )}
              <Separator />
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{totalSteps} steps</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>{allRecipients.length} orgs</span>
                </div>
                {totalSteps > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span>{sentSteps}/{totalSteps} sent</span>
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(sentSteps / totalSteps) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* step timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">steps</CardTitle>
            </CardHeader>
            <CardContent>
              <StepTimeline
                campaignId={id}
                steps={steps}
                audienceCount={allRecipients.length}
              />
            </CardContent>
          </Card>
        </div>

        {/* right column — 1/3 */}
        <div className="space-y-6">
          <RecipientPanel
            campaignId={id}
            audienceFilters={campaign.audienceFilters}
            recipients={allRecipients}
            contactsByOrgId={contactsByOrgId}
            addedContacts={addedContacts}
          />
        </div>
      </div>
    </>
  );
}
