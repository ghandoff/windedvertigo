import { Suspense } from "react";
import { queryOrganizations } from "@/lib/notion/organizations";
import { PageHeader } from "@/app/components/page-header";
import { PipelineBoard } from "@/app/components/pipeline-board";
import { Skeleton } from "@/components/ui/skeleton";

export const revalidate = 300;

function PipelineSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex-shrink-0 w-72">
          <Skeleton className="h-8 w-32 mb-3" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function PipelineData() {
  const { data: organizations } = await queryOrganizations(
    undefined,
    { pageSize: 100 },
  );
  return <PipelineBoard organizations={organizations} />;
}

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="pipeline"
        description="track organizations through your relationship and outreach funnels"
      />
      <Suspense fallback={<PipelineSkeleton />}>
        <PipelineData />
      </Suspense>
    </>
  );
}
