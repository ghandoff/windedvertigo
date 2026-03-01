import { syncMaterials } from "./materials";
import { syncPlaydates } from "./playdates";
import { syncCollections } from "./collections";
import { syncPacks } from "./packs";
import { syncRuns } from "./runs";
import { syncCmsPages } from "./cms-pages";
import { invalidateCandidateCache } from "@/lib/queries/matcher";

/**
 * Orchestrate the full Notion → Postgres sync.
 *
 * Order matters:
 *   1. materials    — no foreign-key deps
 *   2. playdates    — resolves playdate_materials → materials_cache
 *   3. collections  — resolves collection_playdates → playdates_cache
 *   4. packs        — resolves pack_playdates    → playdates_cache
 *   5. runs         — resolves run_materials    → materials_cache
 *   6. cms pages    — standalone, no foreign-key deps (individual pages)
 */
export async function syncAll() {
  const t0 = Date.now();
  console.log("[sync] starting full sync…");

  const materialsCount = await syncMaterials();
  const playdatesCount = await syncPlaydates();
  const collectionsCount = await syncCollections();
  const packsCount = await syncPacks();
  const runsCount = await syncRuns();
  const cmsPageCount = await syncCmsPages();

  // Invalidate matcher cache so new playdates/materials are picked up immediately
  invalidateCandidateCache();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[sync] full sync complete in ${elapsed}s`);

  return { materialsCount, playdatesCount, collectionsCount, packsCount, runsCount, cmsPageCount, elapsedSeconds: elapsed };
}
