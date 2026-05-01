import { Suspense } from "react";
import { queryOrganizations } from "@/lib/notion/organizations";
import { PageHeader } from "@/app/components/page-header";
import { PipelineBoard } from "@/app/components/pipeline-board";
import { DashboardStats } from "@/app/components/dashboard-stats";
import { DocentWelcomeBanner } from "@/app/components/docent-welcome-banner";
import { KanbanSkeleton, StatsStripSkeleton } from "@/app/components/skeletons";

export const revalidate = 300;

async function PipelineData() {
  // Paginate through all records — Notion caps at 100 per call.
  const organizations: Awaited<ReturnType<typeof queryOrganizations>>["data"] = [];
  let cursor: string | undefined;
  do {
    const page = await queryOrganizations(undefined, { pageSize: 100, cursor });
    organizations.push(...page.data);
    cursor = page.nextCursor ?? undefined;
    if (!page.hasMore) break;
  } while (cursor);

  return <PipelineBoard organizations={organizations} />;
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="dashboard"
        description="your operational overview at a glance"
      />
      <DocentWelcomeBanner />
      <Suspense fallback={<StatsStripSkeleton />}>
        <DashboardStats />
      </Suspense>
      <Suspense fallback={<KanbanSkeleton />}>
        <PipelineData />
      </Suspense>
    </>
  );
}
