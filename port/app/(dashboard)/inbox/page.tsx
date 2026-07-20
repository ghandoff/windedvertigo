/**
 * /inbox — human-in-the-loop review queue.
 *
 * Two card types over two tables, same page, same session gate:
 *  - ReviewCard / review_queue — email-detected pipeline updates (RFP
 *    outcomes, payments), binary approve/dismiss.
 *  - InterventionCard / agent_interventions — the ambient-agent spine's
 *    preview cards (docs/prompts/executive-agents-phase1-build.md §2.4),
 *    approve/edit/redirect/ignore. Deliberately NOT a separate
 *    `/agents/inbox` route — same inbox, same review posture, two schemas
 *    (agent_interventions' risk tiers/expiry/artifact don't fit
 *    review_queue's narrow rfp_outcome|payment CHECK constraint).
 *
 * Approving routes through the same durable write paths a human would use;
 * dismissing/ignoring drops the suggestion. Nothing mutates pipeline data
 * (or executes an intervention) until you click approve.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/app/components/page-header";
import { listReviewItems } from "@/lib/review-queue";
import { listInterventions } from "@/lib/supabase/agent-interventions";
import { ReviewCard } from "./components/review-card";
import { InterventionCard } from "./components/intervention-card";

export const metadata: Metadata = { robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  // Degrade gracefully if either migration hasn't been applied yet.
  const [reviewItems, interventions] = await Promise.all([
    listReviewItems("pending").catch(() => []),
    listInterventions("proposed").catch(() => []),
  ]);
  const empty = reviewItems.length === 0 && interventions.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="inbox"
        description="email-detected pipeline updates and agent-proposed interventions awaiting your approval"
      />
      {empty ? (
        <p className="text-sm text-muted-foreground">nothing to review — you’re all caught up.</p>
      ) : (
        <div className="space-y-3">
          {interventions.map((item) => (
            <InterventionCard key={item.id} item={item} />
          ))}
          {reviewItems.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
