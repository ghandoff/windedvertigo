/**
 * /bookings/polls/new — create a group availability poll.
 *
 * Host picks a title, optional description, and a set of discrete candidate
 * slots. On submit a shareable /book/poll/[slug] link is generated.
 */

import { PageHeader } from "@/app/components/page-header";
import Link from "next/link";
import { CreatePollForm } from "./create-poll-form";

export default function NewPollPage() {
  return (
    <div>
      <PageHeader
        title="new group poll"
        description="pick a few candidate times — share the link and let everyone weigh in."
      >
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← back to bookings
        </Link>
      </PageHeader>

      <CreatePollForm />
    </div>
  );
}
