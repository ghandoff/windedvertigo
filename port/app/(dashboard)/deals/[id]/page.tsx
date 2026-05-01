import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DollarSign, CalendarDays, Building2, ExternalLink, FileText, Radar, Mail, Users, ListChecks } from "lucide-react";
import { getDeal } from "@/lib/notion/deals";
import { getOrganization } from "@/lib/notion/organizations";
import { getRfpOpportunity } from "@/lib/notion/rfp-radar";
import { PageHeader } from "@/app/components/page-header";
import { AddDocumentDialog } from "@/app/components/add-document-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const revalidate = 300;

interface Props {
  params: Promise<{ id: string }>;
}

const STAGE_COLORS: Record<string, string> = {
  identified: "bg-gray-100 text-gray-700 border-gray-300",
  pitched: "bg-blue-50 text-blue-700 border-blue-200",
  proposal: "bg-purple-50 text-purple-700 border-purple-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

function formatCurrency(value: number | null): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function docLabel(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    // Google Docs / Drive: last meaningful segment or hostname
    const label = parts[parts.length - 1] ?? u.hostname;
    return decodeURIComponent(label).replace(/-/g, " ").slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params;

  let deal;
  try {
    deal = await getDeal(id);
  } catch {
    notFound();
  }

  // Fetch linked org names in parallel (max 3)
  const orgs = await Promise.all(
    deal.organizationIds.slice(0, 3).map(async (orgId) => {
      try {
        const org = await getOrganization(orgId);
        return { id: org.id, name: org.organization };
      } catch {
        return { id: orgId, name: orgId.slice(0, 8) + "..." };
      }
    }),
  );

  // Fetch linked RFP opportunity (first one if multiple)
  const rfp = deal.rfpOpportunityIds.length > 0
    ? await getRfpOpportunity(deal.rfpOpportunityIds[0]).catch(() => null)
    : null;

  const documentUrls = deal.documents
    ? deal.documents.split("\n").map((u) => u.trim()).filter(Boolean)
    : [];

  return (
    <>
      <Link
        href="/deals"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to deals
      </Link>

      <PageHeader title={deal.deal}>
        <Badge
          variant="outline"
          className={`text-sm ${STAGE_COLORS[deal.stage] ?? ""}`}
        >
          {deal.stage}
        </Badge>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                {deal.owner && (
                  <div>
                    <span className="text-muted-foreground">owner</span>
                    <p className="font-medium">{deal.owner}</p>
                  </div>
                )}
                {deal.value != null && deal.value > 0 && (
                  <div>
                    <span className="text-muted-foreground">value</span>
                    <div className="flex items-center gap-1 font-medium">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatCurrency(deal.value)}
                    </div>
                  </div>
                )}
                {deal.closeDate?.start && (
                  <div>
                    <span className="text-muted-foreground">close date</span>
                    <div className="flex items-center gap-1 font-medium">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(deal.closeDate.start)}
                    </div>
                  </div>
                )}
                {deal.stage === "lost" && deal.lostReason && (
                  <div>
                    <span className="text-muted-foreground">lost reason</span>
                    <p className="font-medium">{deal.lostReason}</p>
                  </div>
                )}
              </div>

              {orgs.length > 0 && (
                <div>
                  <span className="text-muted-foreground">organisations</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {orgs.map((org) => (
                      <Link
                        key={org.id}
                        href={`/organizations/${org.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Building2 className="h-3 w-3" />
                        {org.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {deal.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{deal.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">documents</CardTitle>
              <AddDocumentDialog dealId={deal.id} currentDocuments={deal.documents} />
            </CardHeader>
            <CardContent>
              {documentUrls.length > 0 ? (
                <ul className="space-y-2">
                  {documentUrls.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{docLabel(url)}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">no documents attached yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-6">
          {/* Linked RFP opportunity */}
          {rfp && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-1.5">
                  <Radar className="h-4 w-4" />
                  linked rfp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div>
                  <a
                    href={rfp.url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {rfp.opportunityName}
                    {rfp.url && <ExternalLink className="h-3 w-3" />}
                  </a>
                </div>
                {rfp.proposalDraftUrl && (
                  <a
                    href={rfp.proposalDraftUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-green-700 hover:underline font-medium"
                  >
                    <FileText className="h-3.5 w-3.5 text-green-600" />
                    proposal draft →
                  </a>
                )}
                {rfp.coverLetterUrl && (
                  <a
                    href={rfp.coverLetterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-indigo-700 hover:underline font-medium"
                  >
                    <Mail className="h-3.5 w-3.5 text-indigo-500" />
                    cover letter →
                  </a>
                )}
                {rfp.teamCvsUrl && (
                  <a
                    href={rfp.teamCvsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-teal-700 hover:underline font-medium"
                  >
                    <Users className="h-3.5 w-3.5 text-teal-500" />
                    team cvs →
                  </a>
                )}
                {rfp.questionCount != null && rfp.questionCount > 0 && (
                  rfp.questionBankUrl ? (
                    <a
                      href={rfp.questionBankUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-purple-700 hover:underline font-medium"
                    >
                      <ListChecks className="h-3.5 w-3.5 text-purple-500" />
                      {rfp.questionCount} questions →
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5 text-purple-600">
                      <ListChecks className="h-3.5 w-3.5 text-purple-500" />
                      {rfp.questionCount} questions parsed
                    </span>
                  )
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">deal info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">stage</span>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className={`text-xs ${STAGE_COLORS[deal.stage] ?? ""}`}
                  >
                    {deal.stage}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">created</span>
                <p className="font-medium">{formatDate(deal.createdTime)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">last updated</span>
                <p className="font-medium">{formatDate(deal.lastEditedTime)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
