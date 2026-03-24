import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, ExternalLink } from "lucide-react";
import { getOrganization } from "@/lib/notion/organizations";
import { PageHeader } from "@/app/components/page-header";
import { StatusBadge } from "@/app/components/status-badge";
import { PriorityBadge, FitBadge } from "@/app/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const revalidate = 300;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrganizationDetailPage({ params }: Props) {
  const { id } = await params;

  let org;
  try {
    org = await getOrganization(id);
  } catch {
    notFound();
  }

  return (
    <>
      <Link
        href="/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to organizations
      </Link>

      <PageHeader title={org.organization}>
        {org.email && (
          <Link
            href={`/email?org=${org.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Compose Email
          </Link>
        )}
        {org.website && (
          <a
            href={org.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Website
          </a>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={org.connection} type="connection" />
                <StatusBadge value={org.outreachStatus} type="outreach" />
                <PriorityBadge value={org.priority} />
                <FitBadge value={org.fitRating} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {org.type && (
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className="font-medium">{org.type}</p>
                  </div>
                )}
                {org.friendship && (
                  <div>
                    <span className="text-muted-foreground">Friendship</span>
                    <p className="font-medium">{org.friendship}</p>
                  </div>
                )}
                {org.marketSegment && (
                  <div>
                    <span className="text-muted-foreground">Market Segment</span>
                    <p className="font-medium">{org.marketSegment}</p>
                  </div>
                )}
                {org.quadrant && (
                  <div>
                    <span className="text-muted-foreground">Quadrant</span>
                    <p className="font-medium">{org.quadrant}</p>
                  </div>
                )}
                {org.email && (
                  <div>
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-medium">{org.email}</p>
                  </div>
                )}
                {org.source && (
                  <div>
                    <span className="text-muted-foreground">Source</span>
                    <p className="font-medium">{org.source}</p>
                  </div>
                )}
              </div>

              {org.category.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Categories</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {org.category.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {org.regions.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Regions</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {org.regions.map((r) => (
                      <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {org.serviceLine.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Service Lines</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {org.serviceLine.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bespoke Email Copy */}
          {org.bespokeEmailCopy && (
            <Card className="border-accent/30 bg-accent/5">
              <CardHeader>
                <CardTitle className="text-base">Bespoke Email Copy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {org.bespokeEmailCopy}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Outreach suggestion */}
          {org.outreachSuggestion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outreach Suggestion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{org.outreachSuggestion}</p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {org.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{org.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-6">
          {/* Buying info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buying Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {org.howTheyBuy && (
                <div>
                  <span className="text-muted-foreground">How They Buy</span>
                  <p className="font-medium">{org.howTheyBuy}</p>
                </div>
              )}
              {org.buyerRole && (
                <div>
                  <span className="text-muted-foreground">Buyer Role</span>
                  <p className="font-medium">{org.buyerRole}</p>
                </div>
              )}
              {org.buyingTrigger && (
                <div>
                  <span className="text-muted-foreground">Buying Trigger</span>
                  <p className="font-medium">{org.buyingTrigger}</p>
                </div>
              )}
              {org.targetServices && (
                <div>
                  <span className="text-muted-foreground">Target Services</span>
                  <p className="font-medium">{org.targetServices}</p>
                </div>
              )}
              {org.outreachTarget && (
                <div>
                  <span className="text-muted-foreground">Outreach Target</span>
                  <p className="font-medium">{org.outreachTarget}</p>
                </div>
              )}
              {!org.howTheyBuy && !org.buyerRole && !org.buyingTrigger && !org.targetServices && !org.outreachTarget && (
                <p className="text-muted-foreground">No buying info recorded yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Linked records */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Contacts</span>
                <p className="font-medium">
                  {org.contactIds.length > 0 ? `${org.contactIds.length} linked` : "None"}
                </p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">Projects</span>
                <p className="font-medium">
                  {org.projectIds.length > 0 ? `${org.projectIds.length} linked` : "None"}
                </p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">Competitors</span>
                <p className="font-medium">
                  {org.competitorIds.length > 0 ? `${org.competitorIds.length} linked` : "None"}
                </p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">BD Assets</span>
                <p className="font-medium">
                  {org.bdAssetIds.length > 0 ? `${org.bdAssetIds.length} linked` : "None"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cross-quadrant */}
          {org.crossQuadrant.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cross-Quadrant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {org.crossQuadrant.map((q) => (
                    <Badge key={q} variant="outline" className="text-xs">{q}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
