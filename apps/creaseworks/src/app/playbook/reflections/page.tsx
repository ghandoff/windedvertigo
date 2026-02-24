/**
 * Full reflections list — all logged reflections for the current user.
 * Nested under /playbook/reflections.
 */

import { requireAuth } from "@/lib/auth-helpers";
import { getRunsForUser, batchGetRunMaterials } from "@/lib/queries/runs";
import RunList from "@/components/ui/run-list";
import ExportButton from "@/app/runs/export-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PlaybookReflectionsPage() {
  const session = await requireAuth();
  const runs = await getRunsForUser(session);

  const materialsMap = await batchGetRunMaterials(runs.map((r) => r.id));
  const runsWithMaterials = runs.map((run) => ({
    ...run,
    materials: materialsMap.get(run.id) ?? [],
  }));

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <Link
        href="/playbook"
        className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors mb-6 inline-block"
      >
        &larr; back to playbook
      </Link>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          all reflections
        </h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <ExportButton />
          <Link
            href="/reflections/new"
            className="rounded-lg px-4 sm:px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--wv-redwood)", minHeight: 44 }}
          >
            log a reflection
          </Link>
        </div>
      </div>
      <p className="text-sm text-cadet/50 mb-8">
        track when you&apos;ve used a playdate — what happened, what you
        noticed, and what you&apos;d change next time.
      </p>

      <RunList
        runs={runsWithMaterials}
        currentUserId={session.userId}
        isAdmin={session.isAdmin}
        isInternal={session.isInternal}
      />
    </main>
  );
}
