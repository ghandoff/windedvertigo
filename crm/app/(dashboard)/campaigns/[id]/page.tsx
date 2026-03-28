import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Share2, CalendarDays, Users } from "lucide-react";
import { getCampaign } from "@/lib/notion/campaigns";
import { getStepsForCampaign } from "@/lib/notion/campaign-steps";
import { previewAudience } from "@/lib/notion/audience";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StepTimeline } from "@/app/components/step-timeline";
import { AudiencePanel } from "@/app/components/audience-panel";
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
  try {
    campaign = await getCampaign(id);
  } catch {
    notFound();
  }

  const steps = await getStepsForCampaign(id);
  const hasFilters = campaign.audienceFilters && Object.keys(campaign.audienceFilters).length > 0;
  const audiencePreview = hasFilters
    ? await previewAudience(campaign.audienceFilters, 10)
    : { count: 0, preview: [] };

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
                  <span>{audiencePreview.count} orgs</span>
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
                audienceCount={audiencePreview.count}
              />
            </CardContent>
          </Card>
        </div>

        {/* right column — 1/3 */}
        <div className="space-y-6">
          <AudiencePanel
            campaignId={id}
            filters={campaign.audienceFilters}
            count={audiencePreview.count}
            preview={audiencePreview.preview}
          />
        </div>
      </div>
    </>
  );
}
