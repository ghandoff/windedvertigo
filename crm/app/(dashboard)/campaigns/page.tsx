import { Suspense } from "react";
import Link from "next/link";
import { queryCampaigns } from "@/lib/notion/campaigns";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { CampaignKanban } from "@/app/components/campaign-kanban";
import type { CampaignFilters } from "@/lib/notion/types";

export const revalidate = 300;

const TYPE_OPTIONS = ["event-based", "recurring cadence", "one-off blast"] as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function CampaignBoard({ searchParams }: Props) {
  const params = await searchParams;
  const filters: CampaignFilters = {};
  if (params.type) filters.type = params.type as CampaignFilters["type"];
  if (params.search) filters.search = params.search;

  const { data: campaigns } = await queryCampaigns(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 100 },
  );

  return <CampaignKanban campaigns={campaigns} />;
}

export default async function CampaignsPage(props: Props) {
  return (
    <>
      <PageHeader
        title="campaigns"
        description="plan, schedule, and execute multi-step outreach campaigns"
      >
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + new campaign
        </Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search campaigns..." />
          <FilterSelect paramKey="type" placeholder="type" options={TYPE_OPTIONS} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
        <CampaignBoard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
