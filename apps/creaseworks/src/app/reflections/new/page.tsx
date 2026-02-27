/**
 * Create reflection page — log a new reflection.
 *
 * Lightweight form: must not feel like a tax.
 * Required: title, context of use, date.
 * Optional: playdate link, context tags, trace evidence,
 *           materials used, what changed, next iteration.
 */

import { requireAuth } from "@/lib/auth-helpers";
import { getReadyPlaydatesForPicker } from "@/lib/queries/runs";
import { getAllMaterials } from "@/lib/queries/materials";
import { getFirstVisiblePackForPlaydate, getPackBySlug } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import RunForm from "@/components/ui/run-form/run-form";
import type { ReflectionPackInfo } from "@/components/ui/run-form/run-form";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ playdate?: string }>;
}

export default async function NewReflectionPage({ searchParams }: Props) {
  const session = await requireAuth();
  const { playdate: playdateSlug } = await searchParams;

  const [playdates, materials] = await Promise.all([
    getReadyPlaydatesForPicker(),
    getAllMaterials(),
  ]);

  // Resolve slug to ID for pre-selection
  const matchedPlaydate = playdateSlug
    ? playdates.find((p: any) => p.slug === playdateSlug)
    : null;
  const initialPlaydateId = matchedPlaydate?.id ?? "";

  // Look up pack info for upsell CTA (only for unentitled packs)
  let packInfo: ReflectionPackInfo | null = null;
  if (matchedPlaydate) {
    const pack = await getFirstVisiblePackForPlaydate(matchedPlaydate.id);
    if (pack) {
      const isEntitled = session.orgId
        ? await checkEntitlement(session.orgId, pack.id)
        : false;
      if (!isEntitled) {
        // Fetch full pack to get playdate count
        const fullPack = await getPackBySlug(pack.slug);
        if (fullPack) {
          packInfo = {
            packSlug: pack.slug,
            packTitle: pack.title,
            playdateCount: Number(fullPack.playdate_count) || 0,
          };
        }
      }
    }
  }

  /**
   * Practitioner-level access for evidence capture:
   * - Internal users (windedvertigo.com emails) always have it
   * - Admins always have it
   * - Users with an org have it (entitled via pack purchase)
   */
  const isPractitioner =
    session.isInternal || session.isAdmin || !!session.orgId;

  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-3xl mx-auto">
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
        initialPlaydateId={initialPlaydateId}
        packInfo={packInfo}
      />
    </main>
  );
}
