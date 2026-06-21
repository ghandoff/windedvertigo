/**
 * RFP detail page — full view of a single RFP opportunity.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft, ExternalLink, CalendarDays, DollarSign,
  FileText, Mail, Users, ListChecks, MapPin, Tag, Layers, Pencil,
} from "lucide-react";
import { deadlineAsPT } from "@/lib/format";
import { getRfpOpportunityByIdFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { getOrganizationByIdFromSupabase } from "@/lib/supabase/organizations";
import { getCoverageByRfp, type RfpCoverageRow } from "@/lib/supabase/rfp-requirements";
import { getPortalRegistrations } from "@/lib/supabase/rfp-portal-registrations";
import { getMilestonesByRfp } from "@/lib/supabase/rfp-milestones";
import { RfpPortalTracker } from "@/app/components/rfp-portal-tracker";
import { RfpMilestoneTracker } from "@/app/components/rfp-milestone-tracker";
import { RfpFunderProfile } from "@/app/components/rfp-funder-profile";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { WinProbabilityBadge, computeWinProbability } from "@/app/components/ai-win-probability";
import { RfpDocumentUpload } from "@/app/components/rfp-document-upload";
import { RfpReEnrichButton } from "@/app/components/rfp-re-enrich-button";
import { RfpRegenerateButton } from "@/app/components/rfp-regenerate-button";
import { ProposalProgressTracker } from "@/app/components/proposal-progress";
import type { Organization } from "@/lib/notion/types";
import type { RequirementKind } from "@/lib/supabase/rfp-requirements";

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  radar: "bg-blue-50 text-blue-700 border-blue-200",
  reviewing: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pursuing: "bg-orange-50 text-orange-700 border-orange-200",
  interviewing: "bg-cyan-50 text-cyan-700 border-cyan-200",
  submitted: "bg-purple-50 text-purple-700 border-purple-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
  "no-go": "bg-gray-100 text-gray-600 border-gray-200",
  "missed deadline": "bg-red-50 text-red-400 border-red-100",
};

const FIT_COLORS: Record<string, string> = {
  "high fit": "bg-green-100 text-green-700 border-green-200",
  "medium fit": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "low fit": "bg-gray-100 text-gray-600 border-gray-200",
  "TBD": "bg-blue-50 text-blue-600 border-blue-200",
};

/** Colour-coded kind badge for the compliance matrix. */
const KIND_BADGE_COLORS: Record<RequirementKind, string> = {
  deliverable:          "bg-indigo-50 text-indigo-700 border-indigo-200",
  eligibility:          "bg-red-50 text-red-700 border-red-200",
  evaluation_criterion: "bg-amber-50 text-amber-700 border-amber-200",
  admin:                "bg-gray-100 text-gray-600 border-gray-300",
  submission:           "bg-teal-50 text-teal-700 border-teal-200",
};

const KIND_LABELS: Record<RequirementKind, string> = {
  deliverable:          "deliverable",
  eligibility:          "eligibility",
  evaluation_criterion: "eval criterion",
  admin:                "admin",
  submission:           "submission",
};

function formatCurrency(value: number | null): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight — avoids UTC-offset off-by-one
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return parseDateOnly(dateStr).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((parseDateOnly(dateStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Covered indicator cell content. */
function CoveredIndicator({ covered, approved }: { covered: boolean; approved: boolean }) {
  if (covered) {
    return <span className="text-green-600 font-medium text-sm">✓</span>;
  }
  if (!approved) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return <span className="text-red-500 font-medium text-sm">✗</span>;
}

/** Weighted coverage summary: X / Y requirements covered (Z% weighted). */
function coverageSummary(rows: RfpCoverageRow[]): {
  coveredCount: number;
  totalCount: number;
  weightedPct: number | null;
} {
  const totalCount = rows.length;
  const coveredCount = rows.filter((r) => r.covered).length;

  // Weighted coverage only when weight_pct data is present
  const weighted = rows.filter((r) => r.weightPct !== null);
  if (weighted.length === 0) {
    return { coveredCount, totalCount, weightedPct: null };
  }
  const totalWeight = weighted.reduce((sum, r) => sum + (r.weightPct ?? 0), 0);
  const coveredWeight = weighted
    .filter((r) => r.covered)
    .reduce((sum, r) => sum + (r.weightPct ?? 0), 0);
  const weightedPct = totalWeight > 0 ? Math.round((coveredWeight / totalWeight) * 100) : 0;
  return { coveredCount, totalCount, weightedPct };
}

export default async function RfpDetailPage({ params }: Props) {
  const { id } = await params;

  const rfp = await getRfpOpportunityByIdFromSupabase(id);
  if (!rfp) notFound();

  // Look up linked organizations
  const orgs: Organization[] = rfp.organizationIds.length > 0
    ? (await Promise.all(
        rfp.organizationIds.map((oid) => getOrganizationByIdFromSupabase(oid).catch(() => null)),
      )).filter((o): o is Organization => o !== null)
    : [];

  // Compliance matrix — silently skip if the view query fails (e.g. not yet migrated)
  let coverageRows: RfpCoverageRow[] = [];
  try {
    coverageRows = await getCoverageByRfp(id);
  } catch {
    // Non-fatal: matrix simply won't render
  }

  // Portal registrations — silently skip if table not yet migrated
  const portalRegistrations = await getPortalRegistrations(id).catch(() => []);

  // Milestones — silently skip if table not yet migrated
  const milestones = await getMilestonesByRfp(id).catch(() => []);

  const deadlineDays = daysUntil(rfp.dueDate?.start);
  const deadlineUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7;
  const overdue = deadlineDays !== null && deadlineDays < 0;
  const winProbability = computeWinProbability(rfp);

  const hasProposalOutput = rfp.proposalDraftUrl || rfp.coverLetterUrl || rfp.teamCvsUrl || rfp.expressionOfInterestUrl || rfp.financialProposalUrl;

  const { coveredCount, totalCount, weightedPct } = coverageSummary(coverageRows);

  return (
    <>
      <Link
        href="/rfp-radar"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to RFP lighthouse
      </Link>

      <PageHeader title={rfp.opportunityName}>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/rfp-radar/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            edit
          </Link>
          {rfp.url?.startsWith("http") && (
            <a
              href={rfp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              source
            </a>
          )}
          <Badge variant="outline" className={STATUS_COLORS[rfp.status] ?? ""}>{rfp.status}</Badge>
          {rfp.opportunityType && (
            <Badge variant="outline" className="text-xs">{rfp.opportunityType}</Badge>
          )}
          {rfp.wvFitScore && (
            <Badge variant="outline" className={`text-xs ${FIT_COLORS[rfp.wvFitScore] ?? ""}`}>
              {rfp.wvFitScore}
            </Badge>
          )}
          <WinProbabilityBadge probability={winProbability} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── left column — 2/3 ─────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {rfp.dueDate?.start && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">due date</p>
                    <p className={`font-medium flex items-center gap-1.5 ${overdue ? "text-destructive" : deadlineUrgent ? "text-destructive" : ""}`}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      {overdue ? "overdue — " : ""}{formatDate(rfp.dueDate.start)}
                      {deadlineDays !== null && deadlineDays >= 0 && (
                        <span className={`text-xs font-normal ${deadlineUrgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          ({deadlineDays}d)
                        </span>
                      )}
                    </p>
                    {(() => {
                      const pt = deadlineAsPT(rfp.dueDate.start, rfp.deadlineTimezone);
                      return pt ? (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                          ~{pt} PT (assuming 5pm client time)
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}
                {rfp.estimatedValue != null && rfp.estimatedValue > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">estimated value</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      {formatCurrency(rfp.estimatedValue)}
                    </p>
                  </div>
                )}
                {orgs.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">organization</p>
                    <div className="flex flex-col gap-0.5">
                      {orgs.map((org) => (
                        <Link
                          key={org.id}
                          href={`/organizations/${org.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {org.organization}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {rfp.source && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">source</p>
                    <p className="font-medium">{rfp.source}</p>
                  </div>
                )}
              </div>

              {rfp.serviceMatch.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground text-xs mb-1.5">service match</p>
                    <div className="flex flex-wrap gap-1.5">
                      {rfp.serviceMatch.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(rfp.category.length > 0 || rfp.geography.length > 0) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {rfp.category.length > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1.5 flex items-center gap-1">
                          <Tag className="h-3 w-3" /> category
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rfp.category.map((c) => (
                            <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {rfp.geography.length > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> geography
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rfp.geography.map((g) => (
                            <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* requirements snapshot */}
          {rfp.requirementsSnapshot && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {rfp.requirementsSnapshot}
                </p>
              </CardContent>
            </Card>
          )}

          {/* compliance matrix — only rendered when requirements have been extracted */}
          {coverageRows.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base">compliance matrix</CardTitle>
                  <p className="text-xs text-muted-foreground shrink-0 pt-0.5">
                    {coveredCount} / {totalCount} covered
                    {weightedPct !== null && (
                      <span className="ml-1">({weightedPct}% weighted)</span>
                    )}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 w-[110px]">kind</TableHead>
                      <TableHead>requirement</TableHead>
                      <TableHead className="w-[60px] text-center">weight</TableHead>
                      <TableHead className="w-[56px] text-center">covered</TableHead>
                      <TableHead className="w-[60px] text-center pr-6">confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverageRows.map((row) => (
                      <TableRow key={row.requirementId}>
                        <TableCell className="pl-6">
                          <Badge
                            variant="outline"
                            className={`text-[10px] whitespace-nowrap ${KIND_BADGE_COLORS[row.kind] ?? ""}`}
                          >
                            {KIND_LABELS[row.kind] ?? row.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <span
                            className="block truncate text-sm"
                            title={row.label}
                          >
                            {row.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {row.weightPct !== null ? `${row.weightPct}%` : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <CoveredIndicator covered={row.covered} approved={row.approved} />
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground pr-6">
                          {row.extractionConfidence !== null
                            ? `${Math.round(row.extractionConfidence * 100)}%`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            // Empty state is intentionally omitted — the section only renders when rows exist.
            // The upload card on the right column already prompts the user to upload the RFP document.
            null
          )}

          {/* decision notes */}
          {rfp.decisionNotes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">decision notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {rfp.decisionNotes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* proposal outputs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">proposal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* status indicator — progress tracker replaces badge during generation */}
              {(rfp.proposalStatus === "generating" || rfp.proposalStatus === "queued") ? (
                <ProposalProgressTracker
                  rfpId={id}
                  initialStatus={rfp.proposalStatus}
                  questionBankUrl={rfp.questionBankUrl}
                  questionCount={rfp.questionCount}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs w-16">status</span>
                  {rfp.proposalStatus === "ready-for-review" ? (
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                      ready for review
                    </Badge>
                  ) : rfp.proposalStatus === "complete" ? (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                      complete
                    </Badge>
                  ) : rfp.proposalStatus === "failed" ? (
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                      failed
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {rfp.status === "pursuing" || rfp.status === "submitted"
                        ? "not yet generated"
                        : "move to pursuing to generate"}
                    </span>
                  )}
                </div>
              )}

              {/* Re-generate button — shown when pursuing/submitted and not actively generating */}
              {(rfp.status === "pursuing" || rfp.status === "submitted") &&
               rfp.proposalStatus !== "generating" &&
               rfp.proposalStatus !== "queued" && (
                <RfpRegenerateButton
                  rfpId={id}
                  currentStatus={rfp.proposalStatus}
                />
              )}

              {hasProposalOutput && <Separator />}

              {rfp.proposalDraftUrl && (
                <a
                  href={rfp.proposalDraftUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                >
                  <FileText className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="group-hover:underline">proposal draft →</span>
                </a>
              )}
              {rfp.coverLetterUrl && (
                <a
                  href={rfp.coverLetterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                >
                  <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="group-hover:underline">cover letter →</span>
                </a>
              )}
              {rfp.teamCvsUrl && (
                <a
                  href={rfp.teamCvsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                >
                  <Users className="h-4 w-4 text-teal-600 shrink-0" />
                  <span className="group-hover:underline">team cvs →</span>
                </a>
              )}
              {rfp.questionBankUrl && rfp.questionCount != null && rfp.questionCount > 0 && (
                <a
                  href={rfp.questionBankUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                >
                  <ListChecks className="h-4 w-4 text-purple-600 shrink-0" />
                  <span className="group-hover:underline">{rfp.questionCount} questions parsed →</span>
                </a>
              )}

              {rfp.expressionOfInterestUrl && (
                <a
                  href={rfp.expressionOfInterestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                >
                  <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="group-hover:underline">expression of interest →</span>
                </a>
              )}
              {rfp.financialProposalUrl && (
                <a
                  href={rfp.financialProposalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                >
                  <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="group-hover:underline">financial proposal →</span>
                </a>
              )}

              {!hasProposalOutput && !rfp.proposalStatus && (
                <p className="text-xs text-muted-foreground">
                  proposal documents will appear here once generated. move the opportunity to pursuing to trigger generation.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── right column — 1/3 ─────────────────────── */}
        <div className="space-y-6">

          {/* document upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                rfp document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RfpDocumentUpload rfpId={id} currentUrl={rfp.rfpDocumentUrl} />
              {!rfp.rfpDocumentUrl && rfp.url?.startsWith("http") && (
                <RfpReEnrichButton rfpId={id} />
              )}
              {coverageRows.length === 0 && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  no requirements extracted yet — upload the rfp document to auto-extract
                </p>
              )}
            </CardContent>
          </Card>

          {/* milestones — deadline tracker, PaM's primary bid-killer radar */}
          <RfpMilestoneTracker rfpId={id} milestones={milestones} />

          {/* portal registrations — gates the bid on UNGM/UNICEF registration */}
          <RfpPortalTracker rfpId={id} registrations={portalRegistrations} />

          {/* funder profile — org intelligence + prior bids */}
          <Suspense fallback={
            <div className="h-32 rounded-lg border bg-card animate-pulse" />
          }>
            <RfpFunderProfile rfpId={id} organizationIds={rfp.organizationIds} />
          </Suspense>

          {/* metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {rfp.relatedProjectIds.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">related project(s)</p>
                  <p className="font-medium">{rfp.relatedProjectIds.length} linked</p>
                </div>
              )}
              {rfp.createdTime && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">created</p>
                  <p className="font-medium">
                    {new Date(rfp.createdTime).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
              )}
              {rfp.lastEditedTime && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">last updated</p>
                  <p className="font-medium">
                    {new Date(rfp.lastEditedTime).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
