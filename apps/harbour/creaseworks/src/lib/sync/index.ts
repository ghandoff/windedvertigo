import { syncMaterials } from "./materials";
import { syncPlaydates } from "./playdates";
import { syncCollections } from "./collections";
import { syncPacks } from "./packs";
import { syncRuns } from "./runs";
import { syncCmsPages } from "./cms-pages";
import { syncSiteCopy } from "./site-copy";
import { syncAppConfig } from "./app-config";
import { invalidateCandidateCache } from "@/lib/queries/matcher";

/**
 * Orchestrate the full Notion → Postgres sync.
 *
 * Order matters:
 *   1. materials        — no foreign-key deps
 *   2. playdates        — resolves playdate_materials → materials_cache
 *   3. collections      — resolves collection_playdates → playdates_cache
 *   4. packs            — resolves pack_playdates    → playdates_cache
 *   5. runs             — resolves run_materials    → materials_cache
 *   6. cms pages        — standalone, no foreign-key deps (individual pages)
 *   7. site copy        — standalone, key/value copy blocks
 *   8. app config       — standalone, grouped config items
 *
 * Vault activities sync has been partitioned to vertigo-vault's own
 * /api/cron/sync endpoint (see apps/vertigo-vault/).
 */
export async function syncAll() {
  const t0 = Date.now();
  console.log("[sync] starting full sync…");

  const errors: string[] = [];

  let materialsCount = 0;
  try { materialsCount = await syncMaterials(); } catch (e: any) {
    console.error("[sync] materials failed:", e.message);
    errors.push(`materials: ${e.message}`);
  }

  let playdatesCount = 0;
  try { playdatesCount = await syncPlaydates(); } catch (e: any) {
    console.error("[sync] playdates failed:", e.message);
    errors.push(`playdates: ${e.message}`);
  }

  let collectionsCount = 0;
  try { collectionsCount = await syncCollections(); } catch (e: any) {
    console.error("[sync] collections failed:", e.message);
    errors.push(`collections: ${e.message}`);
  }

  let packsCount = 0;
  try { packsCount = await syncPacks(); } catch (e: any) {
    console.error("[sync] packs failed:", e.message);
    errors.push(`packs: ${e.message}`);
  }

  let runsCount = 0;
  try { runsCount = await syncRuns(); } catch (e: any) {
    console.error("[sync] runs failed:", e.message);
    errors.push(`runs: ${e.message}`);
  }

  let cmsPageCount = 0;
  try { cmsPageCount = await syncCmsPages(); } catch (e: any) {
    console.error("[sync] cms pages failed:", e.message);
    errors.push(`cmsPages: ${e.message}`);
  }

  let siteCopyCount = 0;
  try { siteCopyCount = await syncSiteCopy(); } catch (e: any) {
    console.error("[sync] site copy failed:", e.message);
    errors.push(`siteCopy: ${e.message}`);
  }

  let appConfigCount = 0;
  try { appConfigCount = await syncAppConfig(); } catch (e: any) {
    console.error("[sync] app config failed:", e.message);
    errors.push(`appConfig: ${e.message}`);
  }

  // Invalidate matcher cache so new playdates/materials are picked up immediately
  invalidateCandidateCache();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[sync] full sync complete in ${elapsed}s — ${errors.length} error(s)`);

  return { materialsCount, playdatesCount, collectionsCount, packsCount, runsCount, cmsPageCount, siteCopyCount, appConfigCount, errors, elapsedSeconds: elapsed };
}
