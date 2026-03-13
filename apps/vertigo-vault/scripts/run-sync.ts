/**
 * Standalone sync runner — invokes the vault sync outside of Next.js.
 *
 * Usage:
 *   cd apps/vertigo-vault
 *   npx tsx --tsconfig tsconfig.json scripts/run-sync.ts
 *
 * Required env vars: POSTGRES_URL, NOTION_TOKEN, NOTION_DB_VAULT,
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL
 */

import { syncVaultActivities } from "../lib/sync/vault-activities";

async function main() {
  const t0 = Date.now();
  console.log("[run-sync] starting vault sync…");
  const count = await syncVaultActivities();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[run-sync] done: ${count} activities in ${elapsed}s`);
}

main().catch((err) => {
  console.error("[run-sync] fatal:", err);
  process.exit(1);
});
