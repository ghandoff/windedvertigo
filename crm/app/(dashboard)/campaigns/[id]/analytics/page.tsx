import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCampaign } from "@/lib/notion/campaigns";
import { getStepsForCampaign } from "@/lib/notion/campaign-steps";
import { resolveAudience } from "@/lib/notion/audience";
import { queryEmailDrafts } from "@/lib/notion/email-drafts";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { notFound } from "next/navigation";

export const revalidate = 300;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CampaignAnalyticsPage({ params }: Props) {
  const { id } = await params;

  let campaign;
  try {
    campaign = await getCampaign(id);
  } catch {
    notFound();
  }

  const steps = await getStepsForCampaign(id);
  const hasFilters = campaign.audienceFilters && Object.keys(campaign.audienceFilters).length > 0;
  const audience = hasFilters ? await resolveAudience(campaign.audienceFilters) : [];
  const audienceOrgIds = new Set(audience.map((o) => o.id));

  const { data: allDrafts } = await queryEmailDrafts(undefined, { pageSize: 100 });
  const campaignDrafts = allDrafts.filter((d) => audienceOrgIds.has(d.organizationId));

  const totalSent = campaignDrafts.filter((d) => d.status === "sent").length;
  const totalOpened = campaignDrafts.filter((d) => d.opens > 0).length;
  const totalClicked = campaignDrafts.filter((d) => d.clicks > 0).length;
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  const funnelSteps = [
    { label: "audience", value: audience.length, pct: 100 },
    { label: "sent", value: totalSent, pct: audience.length > 0 ? Math.round((totalSent / audience.length) * 100) : 0 },
    { label: "opened", value: totalOpened, pct: audience.length > 0 ? Math.round((totalOpened / audience.length) * 100) : 0 },
    { label: "clicked", value: totalClicked, pct: audience.length > 0 ? Math.round((totalClicked / audience.length) * 100) : 0 },
  ];

  return (
    <>
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to {campaign.name}
      </Link>

      <PageHeader title={`${campaign.name} — analytics`} />

      {/* summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{audience.length}</p>
            <p className="text-xs text-muted-foreground">audience</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalSent}</p>
            <p className="text-xs text-muted-foreground">sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{openRate}%</p>
            <p className="text-xs text-muted-foreground">open rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-accent">{clickRate}%</p>
            <p className="text-xs text-muted-foreground">click rate</p>
          </CardContent>
        </Card>
      </div>

      {/* funnel visualization */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnelSteps.map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted-foreground text-right">{step.label}</span>
              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/80 rounded-full flex items-center px-2 transition-all"
                  style={{ width: `${Math.max(step.pct, 2)}%` }}
                >
                  <span className="text-[10px] font-medium text-primary-foreground whitespace-nowrap">
                    {step.value}
                  </span>
                </div>
              </div>
              <span className="w-10 text-xs text-muted-foreground">{step.pct}%</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* step breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">steps</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>step</TableHead>
                <TableHead>channel</TableHead>
                <TableHead>status</TableHead>
                <TableHead>sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => (
                <TableRow key={step.id}>
                  <TableCell className="font-medium text-sm">{step.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{step.channel}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        step.status === "sent" ? "bg-green-100 text-green-700" : ""
                      }`}
                    >
                      {step.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {step.sendDate?.start
                      ? new Date(step.sendDate.start).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
