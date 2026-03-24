import { queryOrganizations } from "@/lib/notion/organizations";
import { PageHeader } from "@/app/components/page-header";
import { PipelineBoard } from "@/app/components/pipeline-board";

export const revalidate = 300;

export default async function PipelinePage() {
  const { data: organizations } = await queryOrganizations(
    undefined,
    { pageSize: 100 },
  );

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Track organizations through your relationship and outreach funnels"
      />
      <PipelineBoard organizations={organizations} />
    </>
  );
}
