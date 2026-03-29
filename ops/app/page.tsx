import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import {
  projects,
  teamMembers,
  upcomingMeetings,
  deadlines,
  tasks,
  dispatchTasks,
  financialMetrics,
  dataAsOf,
} from "@/lib/data";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = new Date();
  const date = now
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toLowerCase();

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
      date={date}
      dataAsOf={dataAsOf}
    />
  );
}
