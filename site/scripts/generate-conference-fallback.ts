/**
 * Generate fallback JSON for the conference experience page.
 *
 * Usage: npx tsx scripts/generate-conference-fallback.ts
 *
 * Requires NOTION_TOKEN in the environment.
 */

import { writeFileSync } from "fs";
import { join } from "path";

async function main() {
  // Dynamic import to pick up tsconfig path aliases via tsx
  const { fetchConferenceExperience } = await import("../lib/notion");

  console.log("[fallback] fetching conference experience data from Notion...");
  const data = await fetchConferenceExperience();

  const outPath = join(process.cwd(), "data", "conference-experience.json");
  writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log(
    `[fallback] wrote ${data.screens.length} screens, ${data.agenda.length} agenda items to ${outPath}`,
  );
}

main().catch((err) => {
  console.error("[fallback] failed:", err);
  process.exit(1);
});
