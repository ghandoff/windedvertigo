import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, ClipboardList, Milestone as MilestoneIcon, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { EmptyState } from "@/app/components/empty-state";
import { getProjectByIdFromSupabase } from "@/lib/supabase/projects";
import { getMilestonesFromSupabase } from "@/lib/supabase/milestones";
import { getWorkItemsFromSupabase } from "@/lib/supabase/work-items";
import { getActiveMembersFromSupabase } from "@/lib/supabase/members";
import { BudgetView } from "@/app/(dashboard)/work/contracts/components/budget-view";
import { ProjectKanban } from "./project-kanban";
import { MILESTONE_STATUS_COLORS } from "@/lib/work-constants";
import { DISTRIBUTION, TEAM, WV_COLOURS } from "@/lib/strategy-data";
import { formatDate } from "@/lib/format";
import type { WorkItem } from "@/lib/notion/types";

export const revalidate = 60;

// ── status badge colours ─────────────────────────────────────────────────────

const PROJECT_STATUS_COLORS: Record<string, string> = {
  "in progress": "bg-blue-100 text-blue-700 border-blue-200",
  "in queue":    "bg-gray-100 text-gray-600 border-gray-200",
  "under review":"bg-amber-100 text-amber-700 border-amber-200",
  complete:      "bg-green-100 text-green-700 border-green-200",
  suspended:     "bg-orange-100 text-orange-700 border-orange-200",
  icebox:        "bg-slate-100 text-slate-500 border-slate-200",
  cancelled:     "bg-red-100 text-red-600 border-red-200",
  planning:      "bg-purple-100 text-purple-700 border-purple-200",
};

// ── page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  // Parallel fetch — project lookup first (needed for 404 check)
  const project = await getProjectByIdFromSupabase(id);
  if (!project) notFound();

  // Parallel fetch of related data
  const [{ data: milestones }, workItems, members] = await Promise.all([
    getMilestonesFromSupabase({ projectId: id }),
    getWorkItemsFromSupabase(undefined, undefined, id, false),
    getActiveMembersFromSupabase(),
  ]);

  // Resolve project lead names
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const leadNames = project.projectLeadIds
    .map((lid) => memberMap.get(lid))
    .filter(Boolean) as string[];

  // Build burn map for BudgetView (hours = estimate as a proxy when no timesheets here)
  // We only show BudgetView when budgetHours is set; burn = sum of logged estimates
  const burned = workItems.reduce((sum, wi) => sum + (wi.estimateHours ?? 0), 0);
  const projectBurnMap = new Map<string, number>([[project.id, burned]]);

  const statusColor = PROJECT_STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <>
      {/* ── header ── */}
      <PageHeader
        title={project.project}
        description={project.type ? `${project.type} project` : undefined}
      >
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          projects
        </Link>
        <Badge variant="outline" className={statusColor}>
          {project.status}
        </Badge>
      </PageHeader>

      {/* ── metadata strip ── */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-6 pb-6 border-b">
        {project.type && (
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">type</span>
            {project.type}
          </span>
        )}
        {project.priority && project.priority !== "medium" && (
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">priority</span>
            {project.priority}
          </span>
        )}
        {leadNames.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">lead</span>
            {leadNames.join(", ")}
          </span>
        )}
        {project.timeline?.start && (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(project.timeline.start)}
            {project.timeline.end && ` → ${formatDate(project.timeline.end)}`}
          </span>
        )}
        {project.budgetHours != null && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {project.budgetHours}h budget
          </span>
        )}
      </div>

      {/* ── budget burn (only when budgetHours is set) ── */}
      {project.budgetHours != null && project.budgetHours > 0 && (
        <div className="mb-6">
          <BudgetView projects={[project]} projectBurnMap={projectBurnMap} />
        </div>
      )}

      {/* ── task board ── */}
      <div className="mb-8">
        <h2 className="text-base font-semibold mb-4">tasks</h2>
        {workItems.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="no tasks yet"
            description="create work items in Notion and assign them to this project"
          />
        ) : (
          <ProjectKanban workItems={workItems} projectId={project.id} />
        )}
      </div>

      {/* ── milestones ── */}
      {milestones.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-4">milestones</h2>
          <MilestoneList milestones={milestones} />
        </div>
      )}

      {/* ── strategic context — only when a distribution row links to this project ── */}
      <StrategicContextCard projectId={project.id} />
    </>
  );
}

// ── strategic context card ────────────────────────────────────────────────────

/**
 * Renders a "strategic context" card if the DISTRIBUTION matrix has a row
 * with `linkedProjectId === projectId`. Gives the project detail page a
 * back-link into the strategy distribution tab.
 */
function StrategicContextCard({ projectId }: { projectId: string }) {
  const distRow = DISTRIBUTION.find((d) => d.linkedProjectId === projectId);
  if (!distRow) return null;

  const ownerMember = TEAM.find((t) => t.name === distRow.owner);
  const ownerColour = ownerMember ? WV_COLOURS[ownerMember.colour] : "#aaa";

  return (
    <div className="mt-8">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              strategic context
            </CardTitle>
            <Link
              href="/mo?tab=distribution"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              ← mo
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">owner</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: ownerColour }}
                />
                {distRow.owner}
              </span>
            </span>
            {distRow.support.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">support</span>
                {distRow.support.join(", ")}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">deadline</span>
              {distRow.deadline}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">next action</span>
            {" "}{distRow.nextAction}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── milestone list ────────────────────────────────────────────────────────────

function MilestoneList({
  milestones,
}: {
  milestones: Awaited<ReturnType<typeof getMilestonesFromSupabase>>["data"];
}) {
  const completed = milestones.filter((m) => m.milestoneStatus === "complete").length;
  const total = milestones.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">milestone progress</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {completed} / {total} complete
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {milestones.map((m) => {
            const statusColor =
              MILESTONE_STATUS_COLORS[m.milestoneStatus] ?? "bg-gray-100 text-gray-600 border-gray-200";
            return (
              <div key={m.id} className="flex items-center gap-3 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.milestone}</p>
                  {(m.startDate || m.endDate) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.startDate && formatDate(m.startDate)}
                      {m.startDate && m.endDate && " → "}
                      {m.endDate && formatDate(m.endDate)}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor}`}>
                  {m.milestoneStatus}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
