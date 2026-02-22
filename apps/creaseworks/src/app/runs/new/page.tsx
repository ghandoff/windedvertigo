/**
 * Create run page — log a new pattern run.
 *
 * Lightweight form: must not feel like a tax.
 * Required: title, run type, date.
 * Optional: pattern link, context tags, trace evidence,
 *           materials used, what changed, next iteration.
 *
 * MVP 5 — runs and evidence.
 */

import { requireAuth } from "@/lib/auth-helpers";
import { getReadyPatternsForPicker } from "@/lib/queries/runs";
import { getAllMaterials } from "@/lib/queries/materials";
import RunForm from "@/components/ui/run-form";

export const dynamic = "force-dynamic";

export default async function NewRunPage() {
  await requireAuth();

  const [patterns, materials] = await Promise.all([
    getReadyPatternsForPicker(),
    getAllMaterials(),
  ]);

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        log a run
      </h1>
      <p className="text-sm text-cadet/50 mb-8">
        record when you used a pattern — what happened, what you captured,
        and what you&apos;d do differently.
      </p>

      <RunForm patterns={patterns} materials={materials} />
    </main>
  );
}
