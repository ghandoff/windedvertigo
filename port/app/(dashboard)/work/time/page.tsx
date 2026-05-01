import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { queryTimesheets } from "@/lib/notion/timesheets";
import { getActiveMembers } from "@/lib/notion/members";
import { resolveUserContext, canSee, getNotionUserMap, type UserContext } from "@/lib/role";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, FileText, DollarSign, AlertTriangle, UserX, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import type { Timesheet, TimesheetFilters } from "@/lib/notion/types";
import { GustoSyncButton } from "./gusto-sync-button";
import { TimeTutorialWrapper } from "./time-tutorial-wrapper";
import { TimeViewToggle } from "./time-view-toggle";
import { formatDateWithYear } from "@/lib/format";

export const revalidate = 120;

/** Default hourly rate when a timesheet entry has no rate set */
const DEFAULT_HOURLY_RATE = 50;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  invoiced: "bg-purple-100 text-purple-700 border-purple-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

// ── View resolution ────────────────────────────────────

type TimeView = "mine" | "collective" | "member";

interface ResolvedView {
  view: TimeView;
  personId: string | undefined;
  memberId: string | undefined;
  /** "April 2026" — for display in the month nav */
  monthLabel: string;
  /** ISO date string: first day of the selected month, e.g. "2026-04-01" */
  dateAfter: string;
  /** ISO date string: first day of the month after, e.g. "2026-05-01" */
  dateBefore: string;
}

function resolveView(
  params: Record<string, string | undefined>,
  ctx: UserContext,
  canSeeTeam: boolean,
): ResolvedView {
  // Parse ?month=YYYY-MM, default to the current calendar month
  const now = new Date();
  const monthParam = params.month;
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const dateAfter   = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear    = month === 12 ? year + 1 : year;
  const nextMonth   = month === 12 ? 1 : month + 1;
  const dateBefore  = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const monthLabel  = new Date(year, month - 1).toLocaleString("en-US", {
    month: "long",
    year:  "numeric",
  });

  const dateRange = { dateAfter, dateBefore, monthLabel };

  // Non-team users always see their own
  if (!canSeeTeam) {
    return { view: "mine", personId: ctx.notionUserId ?? undefined, memberId: undefined, ...dateRange };
  }

  // ?member={notionUserId} → individual member view
  if (params.member) {
    return { view: "member", personId: params.member, memberId: params.member, ...dateRange };
  }

  // ?view=collective → all entries
  if (params.view === "collective") {
    return { view: "collective", personId: undefined, memberId: undefined, ...dateRange };
  }

  // Default for admin/team: own entries
  return { view: "mine", personId: ctx.notionUserId ?? undefined, memberId: undefined, ...dateRange };
}

// ── Payroll summary (admin/finance only) ────────────────

function PayrollSummary({
  entries,
  showGustoSync,
}: {
  entries: Timesheet[];
  showGustoSync: boolean;
}) {
  const approvedEntries = entries.filter((e) => e.status === "approved");
  const draftEntries = entries.filter((e) => e.status === "draft");

  if (approvedEntries.length === 0 && draftEntries.length === 0) return null;

  const approvedHours = approvedEntries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const approvedBillable = approvedEntries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + (e.hours ?? 0), 0);

  const estimatedPayroll = approvedEntries.reduce(
    (sum, e) => sum + (e.hours ?? 0) * (e.rate ?? DEFAULT_HOURLY_RATE),
    0,
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          payroll summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-bold tabular-nums">{approvedHours.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">approved hours</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">{approvedBillable.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">billable</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">${estimatedPayroll.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">est. payroll</p>
          </div>
        </div>

        {draftEntries.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-50 text-yellow-700 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{draftEntries.length} draft entries need confirmation ({draftEntries.reduce((s, e) => s + (e.hours ?? 0), 0).toFixed(1)}h)</span>
          </div>
        )}

        {showGustoSync && approvedEntries.length > 0 && (
          <GustoSyncButton
            approvedCount={approvedEntries.length}
            approvedHours={approvedHours}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Unlinked account state ──────────────────────────────

function UnlinkedAccountNotice({ email }: { email: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <UserX className="h-8 w-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm font-medium">account not linked</p>
      <p className="text-xs mt-1 max-w-sm mx-auto">
        your email ({email}) doesn&apos;t match a Notion workspace user.
        ask an admin to verify your Notion account email matches your Google login.
      </p>
    </div>
  );
}

// ── Main content ────────────────────────────────────────

interface MemberOption {
  name: string;
  notionUserId: string;
}

async function TimesheetList({
  ctx,
  resolvedView,
  members,
}: {
  ctx: UserContext;
  resolvedView: ResolvedView;
  members: MemberOption[];
}) {
  const canSeeTeam = canSee(ctx.tier, "team-timesheets");
  const { view, personId } = resolvedView;

  // Non-admin users without a Notion user ID can't query their own data
  if (!canSeeTeam && !ctx.notionUserId) {
    return <UnlinkedAccountNotice email={ctx.email} />;
  }

  const filters: TimesheetFilters = {
    ...(personId ? { personId } : {}),
    dateAfter:  resolvedView.dateAfter,
    dateBefore: resolvedView.dateBefore,
  };

  const { data: entries } = await queryTimesheets(filters, { pageSize: 200 });

  const totalHours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const draftHours = entries
    .filter((e) => e.status === "draft")
    .reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const approvedHours = entries
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const billableHours = entries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + (e.hours ?? 0), 0);

  const showPayroll = canSee(ctx.tier, "payroll-summary") && view !== "mine";
  const showGustoSync = canSee(ctx.tier, "gusto-sync");

  // Resolve display name for individual member view
  const viewingMember = resolvedView.memberId
    ? members.find((m) => m.notionUserId === resolvedView.memberId)
    : undefined;

  const viewLabel =
    view === "mine"
      ? "your"
      : view === "member" && viewingMember
        ? `${viewingMember.name}'s`
        : "collective";

  return (
    <>
      {/* View toggle */}
      <TimeViewToggle
        activeView={view}
        activeMemberId={resolvedView.memberId}
        members={members}
        canSeeTeam={canSeeTeam}
      />

      {/* payroll summary — admin/finance only, collective/member views */}
      {showPayroll && (
        <PayrollSummary entries={entries} showGustoSync={showGustoSync} />
      )}

      {/* summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{viewLabel} hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{draftHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">draft</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{approvedHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">{billableHours.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">billable</p>
          </CardContent>
        </Card>
      </div>

      {/* entries table */}
      {entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">no time entries yet</p>
          <p className="text-xs mt-1">entries will appear here once GCal sync is running or you log time manually</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">entry</th>
                {view !== "mine" && (
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">person</th>
                )}
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">date</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">hours / amount</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">status</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-2">billable</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                // Resolve person name from the entry's personIds
                const entryPerson = entry.personIds?.length
                  ? members.find((m) => entry.personIds!.includes(m.notionUserId))
                  : undefined;

                return (
                  <tr key={entry.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${entry.type === "reimbursement" ? "bg-purple-50/50" : ""}`}>
                    <td className="px-4 py-2.5 text-sm font-medium">
                      {entry.type === "reimbursement" && (
                        <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 mr-1.5">reimbursement</Badge>
                      )}
                      {entry.entry || "untitled"}
                    </td>
                    {view !== "mine" && (
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {entryPerson?.name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatDateWithYear(entry.dateAndTime?.start)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums">
                      {entry.type === "reimbursement"
                        ? `$${(entry.amount ?? 0).toFixed(2)}`
                        : (entry.hours?.toFixed(1) ?? "\u2014")}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[entry.status] ?? ""}`}>
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {entry.billable ? "yes" : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Page ────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TimePage({ searchParams }: Props) {
  const [ctx, params] = await Promise.all([
    resolveUserContext(),
    searchParams,
  ]);
  if (!ctx) redirect("/login");

  const canSeeTeam = canSee(ctx.tier, "team-timesheets");
  const showInvoice = canSee(ctx.tier, "invoice-generation");

  // Build member options for the view toggle (admin/team only)
  let members: MemberOption[] = [];
  if (canSeeTeam) {
    const [activeMembers, notionUserMap] = await Promise.all([
      getActiveMembers(),
      getNotionUserMap(),
    ]);
    members = activeMembers
      .map((m) => ({
        name: m.name.split(" ")[0].toLowerCase(),
        notionUserId: notionUserMap.get(m.email.toLowerCase()) ?? "",
      }))
      .filter((m) => m.notionUserId); // only members with Notion accounts
  }

  const resolvedView = resolveView(params, ctx, canSeeTeam);

  return (
    <>
      <PageHeader
        title="time"
        description="time entries, approvals, and billable hours"
      >
        <TimeTutorialWrapper tier={ctx.tier} />
        <Link
          href="/work/time/reimbursement"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors text-purple-600 border-purple-200"
        >
          <Receipt className="h-3.5 w-3.5" />
          reimbursements
        </Link>
        {showInvoice && (
          <Link
            href="/work/time/invoice"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            generate invoice
          </Link>
        )}
      </PageHeader>
      <Suspense fallback={<div className="text-center py-8 text-muted-foreground text-sm">loading time entries...</div>}>
        <TimesheetList ctx={ctx} resolvedView={resolvedView} members={members} />
      </Suspense>
    </>
  );
}
