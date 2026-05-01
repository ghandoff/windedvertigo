import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { computeCampaignAnalytics } from "@/lib/campaign/analytics";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { notFound } from "next/navigation";

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CampaignAnalyticsPage({ params }: Props) {
  const { id } = await params;

  let analytics;
  try {
    analytics = await computeCampaignAnalytics(id);
  } catch {
    notFound();
  }

  const { campaign, funnel, steps } = analytics;

  // Funnel is the "what actually happened" narrative, anchored at contacted = 100%.
  // `audience` stays in the stat cards (as a "current filter size" indicator) but is
  // deliberately NOT a funnel stage — mixing the current filter with historical sends
  // produces confusing bars when the filter was narrowed after sending (contacted
  // would exceed audience) or broadened (audience would be bigger than contacted but
  // the orgs wouldn't match 1:1). Industry convention (Mailchimp, SendGrid, etc.)
  // anchors analytics funnels at delivered/contacted, not at the current audience.
  const pctOf = (n: number) =>
    funnel.contacted > 0 ? Math.min(100, Math.round((n / funnel.contacted) * 100)) : 0;

  const funnelSteps = [
    { label: "contacted", value: funnel.contacted, pct: pctOf(funnel.contacted) },
    { label: "opened", value: funnel.opened, pct: pctOf(funnel.opened) },
    { label: "clicked", value: funnel.clicked, pct: pctOf(funnel.clicked) },
  ];

  const hasAnyData = funnel.rawEmailsSent > 0 || funnel.failed > 0;

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

      {/* summary cards — click rate first (most reliable human signal) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{funnel.audience}</p>
            <p className="text-xs text-muted-foreground">
              audience
              <span className="block text-[10px] text-muted-foreground/70">orgs</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{funnel.contacted}</p>
            <p className="text-xs text-muted-foreground">
              contacted
              {funnel.rawEmailsSent > funnel.contacted && (
                <span className="block text-[10px] text-muted-foreground/70">
                  {funnel.rawEmailsSent} emails (~{funnel.contactsPerOrg} per org)
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-accent">{funnel.clickRate}%</p>
            <p className="text-xs text-muted-foreground">
              click rate
              {funnel.totalClickEvents > 0 && (
                <span className="block text-[10px] text-muted-foreground/70">
                  {funnel.totalClickEvents} total clicks
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{funnel.openRate}%</p>
            <p className="text-xs text-muted-foreground">
              open rate
              {funnel.machineOpens > 0
                ? <span className="block text-[10px] text-muted-foreground/70">+{funnel.machineOpens} machine filtered</span>
                : funnel.totalOpenEvents > 0 && <span className="block text-[10px] text-muted-foreground/70">{funnel.totalOpenEvents} total opens</span>
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{funnel.clickToOpenRate}%</p>
            <p className="text-xs text-muted-foreground">click-to-open</p>
          </CardContent>
        </Card>
      </div>

      {/* funnel visualization */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnelSteps.map((step) => {
            // Clamp bar width: floor at 2% so tiny values are still visible,
            // ceiling at 100% so no bar ever overflows the track.
            const width = Math.min(100, Math.max(step.pct, 2));
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className="w-20 text-xs text-muted-foreground text-right">{step.label}</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/80 rounded-full flex items-center px-2 transition-all"
                    style={{ width: `${width}%` }}
                  >
                    <span className="text-[10px] font-medium text-primary-foreground whitespace-nowrap">
                      {step.value}
                    </span>
                  </div>
                </div>
                <span className="w-12 text-xs text-muted-foreground">{step.pct}%</span>
              </div>
            );
          })}
          {/* subtitle line: email-event count if fan-out is non-trivial */}
          {funnel.rawEmailsSent > funnel.contacted && funnel.contacted > 0 && (
            <p className="text-[11px] text-muted-foreground/70 text-center pt-1">
              ℹ {funnel.rawEmailsSent} emails sent across {funnel.contacted} org{funnel.contacted === 1 ? "" : "s"} (~{funnel.contactsPerOrg} contacts per org)
            </p>
          )}
          {funnel.machineOpens > 0 && (
            <p className="text-[11px] text-muted-foreground/70 text-center">
              ⚠ {funnel.machineOpens} machine open{funnel.machineOpens !== 1 ? "s" : ""} filtered (Apple MPP / security scanners) — open rate reflects human opens only
            </p>
          )}
        </CardContent>
      </Card>

      {/* step breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">step breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>step</TableHead>
                <TableHead>channel</TableHead>
                <TableHead>status</TableHead>
                <TableHead className="text-right">contacted</TableHead>
                <TableHead className="text-right">emails</TableHead>
                <TableHead className="text-right">skipped</TableHead>
                <TableHead className="text-right">opens</TableHead>
                <TableHead className="text-right">clicks</TableHead>
                <TableHead className="text-right">open %</TableHead>
                <TableHead>date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => {
                const hasSends = step.rawEmailsSent > 0;
                return (
                  <TableRow key={step.id}>
                    <TableCell className="font-medium text-sm">{step.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{step.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          step.status === "sent" ? "bg-green-100 text-green-700" :
                          step.status === "sending" ? "bg-amber-100 text-amber-800 italic" :
                          step.status === "skipped" ? "bg-muted text-muted-foreground" :
                          ""
                        }`}
                      >
                        {step.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {step.channel === "email" && hasSends ? step.contacted : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {step.channel === "email" && hasSends ? step.rawEmailsSent : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {step.skipped > 0 ? step.skipped : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {step.channel === "email" && hasSends ? step.opened : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {step.channel === "email" && hasSends ? step.clicked : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {step.channel === "email" && hasSends
                        ? <span className={step.openRate >= 20 ? "text-green-600 font-medium" : ""}>{step.openRate}%</span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {step.sendDate
                        ? new Date(step.sendDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!hasAnyData && (
        <p className="text-sm text-muted-foreground text-center py-4">
          no email data yet — send a step to see analytics here.
        </p>
      )}
    </>
  );
}
