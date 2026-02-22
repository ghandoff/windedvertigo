/**
 * Runs list page — shows runs for the authenticated user's org.
 *
 * Visibility:
 *   - Admins see all runs
 *   - Org members see all runs for their org
 *   - Users without an org see only their own runs
 *
 * MVP 5 — runs and evidence.
 */

import { requireAuth } from "@/lib/auth-helpers";
import { getRunsForUser, batchGetRunMaterials } from "@/lib/queries/runs";
import RunList from "@/components/ui/run-list";
import ExportButton from "./export-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const session = await requireAuth();
  const runs = await getRunsForUser(session);

  // Single-query batch fetch for materials — audit fix #9: replaces N+1
  const materialsMap = await batchGetRunMaterials(runs.map((r) => r.id));
  const runsWithMaterials = runs.map((run) => ({
    ...run,
    materials: materialsMap.get(run.id) ?? [],
  }));

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">runs</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <ExportButton />
          <Link
            href="/runs/new"
            className="rounded-lg px-4 sm:px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--wv-redwood)", minHeight: 44 }}
          >
            log a run
          </Link>
        </div>
      </div>
      <p className="text-sm text-cadet/50 mb-8">
        track when you&apos;ve used a pattern — what happened, what evidence you
        captured, and what you&apos;d change next time.
      </p>

      <RunList runs={runsWithMaterials} currentUserId={session.userId} isAdmin={session.isAdmin} isInternal={session.isInternal} />
    </main>
  );
}
