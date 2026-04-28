import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import {
  projects as staticProjects,
  teamMembers as staticTeamMembers,
  upcomingMeetings as staticMeetings,
  deadlines,
  tasks as staticTasks,
  dispatchTasks as staticDispatchTasks,
  financialMetrics as staticFinancialMetrics,
  dataAsOf,
} from "@/lib/data";
import { fetchProjects } from "@/lib/notion/projects";
import { fetchTeamMembers } from "@/lib/supabase/team";
import { fetchProjectsFromSupabase } from "@/lib/supabase/projects";
import { fetchContentCalendar, fetchPipelineSummary } from "@/lib/notion/marketing";
import { kvGet } from "@/lib/kv";
import type {
  FinancialMetric,
  Meeting,
  Task,
  DispatchTask,
  ContentItem,
  CampaignMetrics,
  PipelineSummary,
} from "@/lib/types";

/** Try KV first, fall back to static data on null/failure. */
async function kvOrStatic<T>(key: string, fallback: T): Promise<T> {
  const live = await kvGet<T>(key);
  return live ?? fallback;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const EMPTY_PIPELINE: PipelineSummary = { identified: 0, pitched: 0, proposal: 0, won: 0, lost: 0 };

  // Fetch all data domains in parallel
  const [projects, teamMembers, upcomingMeetings, tasks, dispatchTasks, financialMetrics,
         contentCalendar, campaignMetrics, pipelineSummary] =
    await Promise.all([
      fetchProjects().then((live) => live ?? fetchProjectsFromSupabase()).then((live) => live ?? staticProjects),
      fetchTeamMembers().then((live) => live ?? staticTeamMembers),
      kvOrStatic<Meeting[]>("ops:calendar", staticMeetings),
      kvOrStatic<Task[]>("ops:tasks", staticTasks),
      kvOrStatic<DispatchTask[]>("ops:dispatch", staticDispatchTasks),
      kvOrStatic<FinancialMetric[]>("ops:finance", staticFinancialMetrics),
      kvGet<ContentItem[]>("marketing:content-calendar").then(v => v ?? fetchContentCalendar()).then(v => v ?? []),
      kvGet<CampaignMetrics[]>("marketing:campaign-metrics").then(v => v ?? []),
      kvGet<PipelineSummary>("marketing:pipeline-summary").then(v => v ?? fetchPipelineSummary()).then(v => v ?? EMPTY_PIPELINE),
    ]);

  return (
    <DashboardShell
      data={{
        projects,
        teamMembers,
        upcomingMeetings,
        deadlines,
        tasks,
        dispatchTasks,
        financialMetrics,
        contentCalendar,
        campaignMetrics,
        pipelineSummary,
      }}
      user={{
        email: session.user?.email ?? "",
        firstName:
          (session as unknown as Record<string, unknown>).firstName as string ??
          "",
      }}
      dataAsOf={dataAsOf}
    />
  );
}
