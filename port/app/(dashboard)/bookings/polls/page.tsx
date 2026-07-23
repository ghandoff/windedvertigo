import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { listPollsWithCounts } from "@/lib/booking/queries";
import { PollsList } from "./polls-list";
import { Users, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PollsIndexPage() {
  const polls = await listPollsWithCounts();
  const siteOrigin = process.env.SITE_ORIGIN ?? "https://windedvertigo.com";

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="group polls"
        description="find a time that works for everyone — share the link, collect availability."
      >
        <Link href="/bookings/polls/new">
          <Button size="sm" className="text-xs h-7">
            <Plus className="h-3 w-3 mr-1" />
            new poll
          </Button>
        </Link>
      </PageHeader>

      {polls.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">no polls yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            create a group poll to find a time that works for everyone.
          </p>
          <Link href="/bookings/polls/new">
            <Button size="sm">create your first poll</Button>
          </Link>
        </div>
      ) : (
        <PollsList polls={polls} siteOrigin={siteOrigin} />
      )}
    </div>
  );
}
