import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { queryWorkItems } from "@/lib/notion/work-items";
import { queryProjects } from "@/lib/notion/projects";
import { queryTimesheets } from "@/lib/notion/timesheets";
import { queryCycles } from "@/lib/notion/cycles";
import { queryMilestones } from "@/lib/notion/milestones";
import { getActiveMembers } from "@/lib/notion/members";
import type { Cycle, WorkItem } from "@/lib/notion/types";
import { PageHeader } from "@/app/components/page-header";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { KanbanSkeleton } from "@/app/components/skeletons";
import { ProjectsTimeline } from "@/app/components/projects-timeline";

// Contract components
import { ContractBoard } from "@/app/(dashboard)/work/contracts/components/contract-board";
// TimeTracker relocated to the global top-bar (app/components/top-bar-tools.tsx)
// in Phase A of the workflow-tools refactor. Keep the component file around so
// existing tests/docs don't break, but it's no longer embedded on this page.
import { BudgetView } from "@/app/(dashboard)/work/contracts/components/budget-view";

// Studio components
import { CycleBoard } from "@/app/(dashboard)/work/studios/components/cycle-board";
import { Backlog } from "@/app/(dashboard)/work/studios/components/backlog";
import { Roadmap } from "@/app/(dashboard)/work/studios/components/roadmap";
import { TimelineView } from "@/app/(dashboard)/work/studios/components/timeline-view";
import { StudioTabs } from "@/app/(dashboard)/work/studios/components/studio-tabs";

// Shared AI tools
import { AiTaskGenerator } from "@/app/(dashboard)/work/components/ai-task-generator";
import { AiMeetingActions } from "@/app/(dashboard)/work/components/ai-meeting-actions";

export const revalidate = 120;

const TABS: TabDef[] = [
  { key: "timeline", label: "timeline" },
  { key: "contracts", label: "contracts" },
  { key: "studios", label: "studios" },
];

// ── timeline content ─────────────────────────────────────────

async function TimelineContent() {
  const [
    session,
    { data: projects },
    { data: milestones },
    { data: workItems },
    { data: timesheets },
    members,
  ] = await Promise.all([
    auth(),
    queryProjects({ archive: false }, { pageSize: 100 }),
    queryMilestones(undefined, { pageSize: 100, fetchAll: true }),
    queryWorkItems({ archive: false }, { pageSize: 100, fetchAll: true }),
    queryTimesheets(undefined, { pageSize: 100, fetchAll: true }),
    getActiveMembers(),
  ]);

  // Build burn map (hours logged against each project) from non-draft
  // timesheets, matched by workItem → project.
  const workItemMap = new Map(workItems.map((wi) => [wi.id, wi]));
  const projectBurnMap = new Map<string, number>();
  for (const ts of timesheets) {
    if (ts.status === "draft") continue;
    const hours = ts.hours ?? 0;
    for (const taskId of ts.taskIds) {
      const wi = workItemMap.get(taskId);
      if (!wi) continue;
      for (const pid of wi.projectIds) {
        projectBurnMap.set(pid, (projectBurnMap.get(pid) ?? 0) + hours);
      }
    }
  }

  // Group non-archived work items by milestone for the hover preview
  // and claim modal in ProjectsTimeline.
  const milestoneTaskMap: Record<string, WorkItem[]> = {};
  for (const wi of workItems) {
    for (const mid of wi.milestoneIds) {
      (milestoneTaskMap[mid] ??= []).push(wi);
    }
  }

  // Resolve the signed-in user's Notion member id so the claim button
  // knows who "I'll take this" refers to.
  const email = session?.user?.email?.toLowerCase() ?? null;
  const currentUserId = email
    ? members.find((m) => m.email.toLowerCase() === email)?.id ?? null
    : null;

  return (
    <ProjectsTimeline
      projects={projects}
      milestones={milestones}
      members={members}
      milestoneTaskMap={milestoneTaskMap}
      currentUserId={currentUserId}
      projectBurnMap={projectBurnMap}
    />
  );
}

// ── contract content ─────────────────────────────────────────

async function ContractContent() {
  const [{ data: projects }, { data: workItems }, { data: timesheets }] = await Promise.all([
    queryProjects({ archive: false }, { pageSize: 100 }),
    queryWorkItems({ archive: false }, { pageSize: 500 }),
    queryTimesheets(undefined, { pageSize: 100 }),
  ]);

  const contractProjects = projects.filter((p) => p.type === "contract");
  const contractProjectIds = new Set(contractProjects.map((p) => p.id));
  const contractItems = workItems.filter((wi) =>
    wi.projectIds.some((pid) => contractProjectIds.has(pid)),
  );

  const workItemMap = new Map(workItems.map((wi) => [wi.id, wi]));
  const projectBurnMap = new Map<string, number>();
  for (const ts of timesheets) {
    if (ts.status === "draft") continue;
    const hours = ts.hours ?? 0;
    for (const taskId of ts.taskIds) {
      const wi = workItemMap.get(taskId);
      if (!wi) continue;
      for (const pid of wi.projectIds) {
        projectBurnMap.set(pid, (projectBurnMap.get(pid) ?? 0) + hours);
      }
    }
  }

  const firstProject = contractProjects[0] ?? null;

  return (
    <>
      <div className="mb-6">
        <BudgetView projects={contractProjects} projectBurnMap={projectBurnMap} />
      </div>
      <ContractBoard workItems={contractItems} projects={contractProjects} />
      {firstProject && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <AiTaskGenerator projectId={firstProject.id} projectName={firstProject.project} />
          <AiMeetingActions projectId={firstProject.id} />
        </div>
      )}
    </>
  );
}

// ── studio content ───────────────────────────────────────────

interface StudioProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function StudioContent({ searchParams }: StudioProps) {
  const params = await searchParams;
  const view = params.view ?? "cycle";
  const cycleId = params.cycleId;

  const [{ data: cycles }, { data: projects }, { data: workItems }, { data: allMilestones }] = await Promise.all([
    queryCycles(undefined, { pageSize: 20 }),
    queryProjects({ archive: false }, { pageSize: 100 }),
    queryWorkItems({ archive: false }, { pageSize: 500 }),
    queryMilestones(undefined, { pageSize: 100 }),
  ]);

  const studioProjects = projects.filter((p) => p.type === "studio" || !p.type);
  const studioProjectIds = new Set(studioProjects.map((p) => p.id));
  const studioItems = workItems.filter((wi) =>
    wi.projectIds.some((pid) => studioProjectIds.has(pid)),
  );
  const studioMilestones = allMilestones.filter((m) =>
    m.projectIds.some((pid) => studioProjectIds.has(pid)),
  );

  const activeCycle: Cycle | null = (cycleId ? cycles.find((c) => c.id === cycleId) : undefined)
    ?? cycles.find((c) => c.status === "active")
    ?? cycles.find((c) => c.status === "planned")
    ?? cycles[0]
    ?? null;

  const cycleProjectIds = activeCycle
    ? new Set(activeCycle.projectIds)
    : new Set<string>();

  const cycleItems = activeCycle
    ? studioItems.filter((wi) => wi.projectIds.some((pid) => cycleProjectIds.has(pid)))
    : [];

  const completedStatuses = new Set(["complete", "cancelled", "icebox"]);
  const backlogItems = studioItems.filter(
    (wi) => !completedStatuses.has(wi.status),
  );

  return (
    <>
      <StudioTabs activeView={view} />

      {view === "cycle" && (
        <CycleBoard cycle={activeCycle} cycles={cycles} workItems={cycleItems} projects={studioProjects} />
      )}
      {view === "backlog" && (
        <Backlog workItems={backlogItems} projects={studioProjects} />
      )}
      {view === "roadmap" && (
        <Roadmap workItems={studioItems} projects={studioProjects} cycles={cycles} />
      )}
      {view === "timeline" && (
        <TimelineView cycles={cycles} milestones={studioMilestones} workItems={studioItems} projects={studioProjects} />
      )}

      {studioProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <AiTaskGenerator projectId={studioProjects[0].id} projectName={studioProjects[0].project} />
          <AiMeetingActions projectId={studioProjects[0].id} />
        </div>
      )}
    </>
  );
}

// ── main page ────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ProjectsPage(props: Props) {
  const params = await props.searchParams;
  const activeTab = TABS.some((t) => t.key === params.type) ? params.type! : "timeline";

  const descriptions: Record<string, string> = {
    timeline: "everything on the calendar — grouped by project lead, coloured by status.",
    contracts: "task boards and time tracking for client projects",
    studios: "product backlog, cycles, and roadmap for harbour apps",
  };

  return (
    <>
      <PageHeader
        title="projects"
        description={descriptions[activeTab] ?? descriptions.timeline}
      />

      <Suspense>
        <UrlTabs paramKey="type" tabs={TABS} activeTab={activeTab} />
      </Suspense>

      {activeTab === "timeline" && (
        <Suspense fallback={<KanbanSkeleton />}>
          <TimelineContent />
        </Suspense>
      )}

      {activeTab === "contracts" && (
        <Suspense fallback={<KanbanSkeleton />}>
          <ContractContent />
        </Suspense>
      )}

      {activeTab === "studios" && (
        <Suspense fallback={<KanbanSkeleton />}>
          <StudioContent searchParams={props.searchParams} />
        </Suspense>
      )}
    </>
  );
}
