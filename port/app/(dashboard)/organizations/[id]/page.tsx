import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, ExternalLink, Users, Pencil } from "lucide-react";
import { getOrganization } from "@/lib/notion/organizations";
import { getContact } from "@/lib/notion/contacts";
import { getActivitiesForOrg } from "@/lib/notion/activities";
import { queryEmailDraftsByOrg } from "@/lib/notion/email-drafts";
import { NewContactDialog } from "@/app/components/new-contact-dialog";
import { LogActivityDialog } from "@/app/components/log-activity-dialog";
import { PageHeader } from "@/app/components/page-header";
import { FitBadge } from "@/app/components/priority-badge";
import { ActivityTimeline } from "@/app/components/activity-timeline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AiOutreachCard } from "@/app/components/ai-outreach-card";
import { EnrichOrgButton } from "@/app/components/enrich-org-button";
import { OrgLogo } from "@/app/components/org-logo";
import { EngagementProfile } from "@/app/components/engagement-profile";

export const revalidate = 300;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrganizationDetailPage({ params }: Props) {
  const { id } = await params;

  let org;
  try {
    org = await getOrganization(id);
  } catch (e) {
    console.error("[org-detail] getOrganization failed for id:", id, e);
    notFound();
  }

  // Fetch activities, linked contacts, and email history in parallel
  const [activitiesResult, linkedContacts, emailDraftsResult] = await Promise.all([
    getActivitiesForOrg(org.id).catch((e) => {
      console.error("[org-detail] getActivitiesForOrg failed:", e);
      return { data: [] as import("@/lib/notion/types").Activity[] };
    }),
    Promise.all(
      (org.contactIds ?? []).slice(0, 10).map(async (cId) => {
        try {
          const c = await getContact(cId);
          return { id: c.id, name: c.name, role: c.role, email: c.email, contactWarmth: c.contactWarmth, relationshipStage: c.relationshipStage };
        } catch {
          return { id: cId, name: cId.slice(0, 8) + "...", role: "", email: "", contactWarmth: null, relationshipStage: null };
        }
      }),
    ),
    queryEmailDraftsByOrg(org.id, { pageSize: 20 }).catch(() => ({ data: [] as import("@/lib/notion/types").EmailDraft[] })),
  ]);
  const activities = activitiesResult.data;
  const emailDrafts = emailDraftsResult.data.filter((d) => d.status === "sent");

  return (
    <>
      <Link
        href="/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to organisations
      </Link>

      <PageHeader title={org.organization}>
        <Link
          href={`/organizations/${id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Pencil className="h-4 w-4" />
          edit
        </Link>
        <EnrichOrgButton orgId={org.id} hasWebsite={!!org.website} />
        <Link
          href={`/email?org=${org.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Mail className="h-4 w-4" />
          compose email
        </Link>
        {org.website && (
          <a
            href={org.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            website
          </a>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(org.logo || org.description) && (
                <div className="flex items-start gap-3 pb-2">
                  {org.logo && <OrgLogo src={org.logo} />}
                  {org.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{org.description}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">{org.relationship}</Badge>
                <FitBadge value={org.fitRating} />
                <Badge variant="outline" className="text-[10px]">{org.derivedPriority}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {org.type && (
                  <div>
                    <span className="text-muted-foreground">type</span>
                    <p className="font-medium">{org.type}</p>
                  </div>
                )}
                {org.marketSegment && (
                  <div>
                    <span className="text-muted-foreground">market segment</span>
                    <p className="font-medium">{org.marketSegment}</p>
                  </div>
                )}
                {org.quadrant && (
                  <div>
                    <span className="text-muted-foreground">quadrant</span>
                    <p className="font-medium">{org.quadrant}</p>
                  </div>
                )}
                {org.email && (
                  <div>
                    <span className="text-muted-foreground">email</span>
                    <p className="font-medium">{org.email}</p>
                  </div>
                )}
                {org.source && (
                  <div>
                    <span className="text-muted-foreground">source</span>
                    <p className="font-medium">{org.source}</p>
                  </div>
                )}
                {org.linkedinUrl && (
                  <div>
                    <span className="text-muted-foreground">linkedin</span>
                    <a
                      href={org.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline block truncate"
                    >
                      {org.linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/company\//, "").replace(/\/$/, "")}
                    </a>
                  </div>
                )}
              </div>

              {org.category.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">categories</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {org.category.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {org.regions.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">regions</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {org.regions.map((r) => (
                      <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {org.serviceLine.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">service lines</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {org.serviceLine.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {org.enrichedAt && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  enriched {new Date(org.enrichedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* bespoke email copy */}
          {org.bespokeEmailCopy && (
            <Card className="border-accent/30 bg-accent/5">
              <CardHeader>
                <CardTitle className="text-base">bespoke email copy</CardTitle>
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
                <CardTitle className="text-base">outreach suggestion</CardTitle>
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
                <CardTitle className="text-base">notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{org.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Engagement profile */}
          <EngagementProfile drafts={emailDrafts} allDrafts={emailDraftsResult.data} orgId={org.id} />

          {/* Activity timeline */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">activity timeline</CardTitle>
              <LogActivityDialog organizationIds={[org.id]} />
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={activities} />
            </CardContent>
          </Card>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-6">
          {/* Buying info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">buying info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {org.howTheyBuy && (
                <div>
                  <span className="text-muted-foreground">how they buy</span>
                  <p className="font-medium">{org.howTheyBuy}</p>
                </div>
              )}
              {org.buyerRole && (
                <div>
                  <span className="text-muted-foreground">buyer role</span>
                  <p className="font-medium">{org.buyerRole}</p>
                </div>
              )}
              {org.buyingTrigger && (
                <div>
                  <span className="text-muted-foreground">buying trigger</span>
                  <p className="font-medium">{org.buyingTrigger}</p>
                </div>
              )}
              {org.targetServices && (
                <div>
                  <span className="text-muted-foreground">target services</span>
                  <p className="font-medium">{org.targetServices}</p>
                </div>
              )}
              {org.outreachTarget && (
                <div>
                  <span className="text-muted-foreground">outreach target</span>
                  <p className="font-medium">{org.outreachTarget}</p>
                </div>
              )}
              {!org.howTheyBuy && !org.buyerRole && !org.buyingTrigger && !org.targetServices && !org.outreachTarget && (
                <p className="text-muted-foreground">no buying info recorded yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">contacts</CardTitle>
              <NewContactDialog organizationId={org.id} compact />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {linkedContacts.length > 0 ? (
                [...linkedContacts]
                  .sort((a, b) => {
                    const order = { hot: 0, warm: 1, lukewarm: 2, cold: 3 };
                    return (order[a.contactWarmth as keyof typeof order] ?? 4) - (order[b.contactWarmth as keyof typeof order] ?? 4);
                  })
                  .map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted transition-colors">
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-2 min-w-0 flex-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-xs truncate">{c.name}</p>
                        {c.role && <p className="text-[10px] text-muted-foreground truncate">{c.role}</p>}
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.contactWarmth && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          c.contactWarmth === "hot" ? "bg-red-100 text-red-700" :
                          c.contactWarmth === "warm" ? "bg-orange-100 text-orange-700" :
                          c.contactWarmth === "lukewarm" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{c.contactWarmth}</span>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-[10px] text-accent hover:underline"
                        >
                          email
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-xs py-2">no contacts linked yet</p>
              )}
            </CardContent>
          </Card>

          {/* AI outreach suggestions */}
          <AiOutreachCard organizationId={org.id} />

          {/* Other linked records */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">linked records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">projects</span>
                <p className="font-medium">
                  {org.projectIds.length > 0 ? `${org.projectIds.length} linked` : "None"}
                </p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">competitors</span>
                <p className="font-medium">
                  {org.competitorIds.length > 0 ? `${org.competitorIds.length} linked` : "None"}
                </p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">BD assets</span>
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
                <CardTitle className="text-base">cross-quadrant</CardTitle>
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
