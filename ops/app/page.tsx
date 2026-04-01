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
import { kvGet } from "@/lib/kv";
import type {
  FinancialMetric,
  TeamMember,
  Meeting,
  Task,
  DispatchTask,
} from "@/lib/types";

/** Try KV first, fall back to static data on null/failure. */
async function kvOrStatic<T>(key: string, fallback: T): Promise<T> {
  const live = await kvGet<T>(key);
  return live ?? fallback;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch all data domains in parallel — KV first, static fallback
  const [projects, teamMembers, upcomingMeetings, tasks, dispatchTasks, financialMetrics] =
    await Promise.all([
      fetchProjects().then((live) => live ?? staticProjects),
      kvOrStatic<TeamMember[]>("ops:team", staticTeamMembers),
      kvOrStatic<Meeting[]>("ops:calendar", staticMeetings),
      kvOrStatic<Task[]>("ops:tasks", staticTasks),
      kvOrStatic<DispatchTask[]>("ops:dispatch", staticDispatchTasks),
      kvOrStatic<FinancialMetric[]>("ops:finance", staticFinancialMetrics),
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
