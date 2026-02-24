/**
 * Create run page — log a new reflection.
 *
 * Lightweight form: must not feel like a tax.
 * Required: title, run type, date.
 * Optional: playdate link, context tags, trace evidence,
 *           materials used, what changed, next iteration.
 *
 * MVP 5 — runs and evidence.
 */

import { requireAuth } from "@/lib/auth-helpers";
import { getReadyPlaydatesForPicker } from "@/lib/queries/runs";
import { getAllMaterials } from "@/lib/queries/materials";
import RunForm from "@/components/ui/run-form";

export const dynamic = "force-dynamic";

export default async function NewRunPage() {
  const session = await requireAuth();

  const [playdates, materials] = await Promise.all([
    getReadyPlaydatesForPicker(),
    getAllMaterials(),
  ]);

  /**
   * Practitioner-level access for evidence capture:
   * - Internal users (windedvertigo.com emails) always have it
   * - Admins always have it
   * - Users with an org have it (entitled via pack purchase)
   *
   * In Phase C we can refine this to check specific entitlements.
   */
  const isPractitioner =
    session.isInternal || session.isAdmin || !!session.orgId;

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        log a reflection
      </h1>
      <p className="text-sm text-cadet/50 mb-8">
        record when you used a playdate — what happened, what you noticed,
        and what you&apos;d do differently.
      </p>

      <RunForm
        playdates={playdates}
        materials={materials}
        isPractitioner={isPractitioner}
      />
    </main>
  );
}
