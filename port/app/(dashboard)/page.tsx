import { Suspense } from "react";
import { getOrganizationsFromSupabase } from "@/lib/supabase/organizations";
import { PageHeader } from "@/app/components/page-header";
import { PipelineBoard } from "@/app/components/pipeline-board";
import { DashboardStats } from "@/app/components/dashboard-stats";
import { DocentWelcomeBanner } from "@/app/components/docent-welcome-banner";
import { KanbanSkeleton, StatsStripSkeleton } from "@/app/components/skeletons";

export const revalidate = 300;

async function PipelineData() {
  try {
    const { data: organizations } = await getOrganizationsFromSupabase({}, { pageSize: 500 });
    return <PipelineBoard organizations={organizations} />;
  } catch (err) {
    console.error("[dashboard/pipeline] failed to load organizations:", err);
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">
          pipeline unavailable — check Supabase connection
        </p>
      </div>
    );
  }
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
