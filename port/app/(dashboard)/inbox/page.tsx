/**
 * /inbox — human-in-the-loop review queue.
 *
 * Email-detected pipeline updates (RFP outcomes, payments) land here as PROPOSED
 * changes. Approving routes through the same durable write paths a human would
 * use; dismissing drops the suggestion. Nothing mutates pipeline data until you
 * click approve.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/app/components/page-header";
import { listReviewItems } from "@/lib/review-queue";
import { ReviewCard } from "./components/review-card";

export const metadata: Metadata = { robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  // Degrade gracefully if the review_queue migration hasn't been applied yet.
  const items = await listReviewItems("pending").catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="inbox"
        description="email-detected pipeline updates awaiting your approval"
      />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">nothing to review — you’re all caught up.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
