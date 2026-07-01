import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listPolls } from "@/lib/booking/queries";
import { Users, Plus, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PollsIndexPage() {
  const polls = await listPolls();
  const siteOrigin = process.env.SITE_ORIGIN ?? "https://windedvertigo.com";

  return (
    <div>
      <PageHeader
        title="group polls"
        description="find a time that works for everyone — share the link, collect availability."
      >
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← bookings
        </Link>
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
        <div className="space-y-2">
          {polls.map((poll) => {
            const shareUrl = `${siteOrigin}/book/poll/${poll.slug}`;
            return (
              <div
                key={poll.id}
                className="rounded-md border p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/bookings/polls/${poll.id}`}
                      className="font-medium text-sm hover:underline underline-offset-4"
                    >
                      {poll.title}
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {poll.locked_option_id ? (
                        <>
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
                          locked
                        </>
                      ) : (
                        <>
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />
                          open
                        </>
                      )}
                    </Badge>
                  </div>
                  {poll.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                      {poll.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    created{" "}
                    {new Date(poll.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={shareUrl}
                    target="_blank"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    share link
                  </Link>
                  <Link href={`/bookings/polls/${poll.id}`}>
                    <Button variant="outline" size="sm" className="text-xs h-7">
                      view results
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
