import { syncMaterials } from "./materials";
import { syncPatterns } from "./patterns";
import { syncPacks } from "./packs";
import { syncRuns } from "./runs";
import { invalidateCandidateCache } from "@/lib/queries/matcher";

/**
 * Orchestrate the full Notion → Postgres sync.
 *
 * Order matters:
 *   1. materials  — no foreign-key deps
 *   2. patterns   — resolves pattern_materials → materials_cache
 *   3. packs      — resolves pack_patterns    → patterns_cache
 *   4. runs       — resolves run_materials    → materials_cache
 */
export async function syncAll() {
  const t0 = Date.now();
  console.log("[sync] starting full sync…");

  const materialsCount = await syncMaterials();
  const patternsCount = await syncPatterns();
  const packsCount = await syncPacks();
  const runsCount = await syncRuns();

  // Invalidate matcher cache so new patterns/materials are picked up immediately
  invalidateCandidateCache();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[sync] full sync complete in ${elapsed}s`);

  return { materialsCount, patternsCount, packsCount, runsCount, elapsedSeconds: elapsed };
}
