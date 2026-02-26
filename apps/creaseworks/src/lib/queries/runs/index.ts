/**
 * Run queries — CRUD and visibility-aware listing.
 *
 * Visibility model (from DESIGN.md section 10):
 *   - Internal admins: see all runs across all orgs
 *   - Internal org users: see all runs for their org
 *   - External org users: see only their own runs
 *
 * App-created runs use `notion_id = 'app:<uuid>'` to distinguish
 * from Notion-synced runs.
 *
 * MVP 5 — runs and evidence.
 */

/* Re-export shared enums so existing imports keep working */
export { RUN_TYPES, TRACE_EVIDENCE_OPTIONS, CONTEXT_TAGS as RUN_CONTEXT_TAGS } from "@/lib/constants/enums";

/* Re-export types */
export type { RunRow, CreateRunInput, SessionVisibility, SessionMinimal, SessionExport } from "./types";

/* Re-export list queries */
export { getRunsForUser } from "./list-queries";

/* Re-export detail queries */
export { getRunById, getRunMaterials, batchGetRunMaterials } from "./detail-queries";

/* Re-export mutations */
export { createRun, updateRun } from "./mutations";

/* Re-export export queries */
export { getRunsForExport } from "./export-queries";

/* Re-export picker queries */
export { getReadyPlaydatesForPicker } from "./picker-queries";
