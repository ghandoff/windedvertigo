import { queryRfpFeedSources } from "@/lib/notion/rfp-feeds";
import { PageHeader } from "@/app/components/page-header";
import { FeedSourcesManager } from "@/app/components/rfp-feed-sources-manager";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const revalidate = 0;

export default async function RfpFeedsPage() {
  const { data: feeds } = await queryRfpFeedSources(false);

  return (
    <>
      <Link
        href="/rfp-radar"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to rfp radar
      </Link>

      <PageHeader title="feed sources">
        <p className="text-sm text-muted-foreground">
          RSS feeds, Google Alerts, and procurement databases polled daily
        </p>
      </PageHeader>

      <FeedSourcesManager initialFeeds={feeds} />
    </>
  );
}
