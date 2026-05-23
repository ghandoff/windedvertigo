/**
 * port/lib/marketing/pipeline-progress.ts
 *
 * Tier 1 of the pipeline-counts operationalization plan
 * (see port/docs/pipeline-counts-operationalization.md).
 *
 * Derives the bottom two funnel-stage counts (proposals-in-flight,
 * contracts-signed-this-month) from real data sources rather than the
 * hardcoded `current` values in PIPELINE_PROGRESS:
 *
 *   - **proposals-in-flight**: live count from Supabase
 *     `rfp_opportunities` rows with status='pursuing' and proposal_status
 *     not yet failed or complete
 *
 *   - **contracts-signed**: live count from Supabase `deals` rows where
 *     `revenue_tier = 'signed'`. Updated via CMO PATCH or the deal sync cron.
 *
 * The top three funnel stages (awareness / engagement / conversation) stay
 * null until tier 2 (the weekly admin form) lands.
 *
 * Returns an `overrides` map keyed by stage id — strategy-data.ts'
 * PIPELINE_PROGRESS still acts as the default + target source; this just
 * supplies fresher `current` values where derivable.
 */

import { supabase } from "@/lib/supabase/client";

export interface PipelineProgressOverrides {
  proposal: number | null;
  contract: number | null;
  /** so the UI can label the data freshness */
  derivedAt: string;
  /** errors from sub-queries — UI can surface as a warning pill */
  errors: { stage: "proposal" | "contract"; message: string }[];
}

/**
 * Reads the current pipeline-stage counts where they're derivable from
 * primary data. Returns an overrides map; null fields fall through to the
 * default `current` in PIPELINE_PROGRESS.
 *
 * Fire-and-forget safe — callers should pass `null` to PIPELINE_PROGRESS
 * if this throws so the UI shows the "awaiting first input" pill rather
 * than crashing.
 */
export async function getPipelineProgress(): Promise<PipelineProgressOverrides> {
  const errors: PipelineProgressOverrides["errors"] = [];

  // ── proposals in flight ────────────────────────────────────────────
  // status='pursuing' AND proposal_status not yet terminal (failed/complete)
  // captures everything actively being drafted, in QA, or pending review.
  let proposal: number | null = null;
  try {
    const { count, error } = await supabase
      .from("rfp_opportunities")
      .select("notion_page_id", { count: "exact", head: true })
      .eq("status", "pursuing")
      .not("proposal_status", "in", "(failed,complete)");
    if (error) {
      errors.push({ stage: "proposal", message: error.message });
    } else {
      proposal = count ?? 0;
    }
  } catch (err) {
    errors.push({
      stage: "proposal",
      message: err instanceof Error ? err.message : "supabase query failed",
    });
  }

  // ── contracts signed ────────────────────────────────────────────────
  // Count deals where revenue_tier = 'signed' in Supabase.
  // Primary source now that deals carry a revenue_tier field.
  // Falls back to null (UI shows "awaiting first input" pill) on query error.
  let contract: number | null = null;
  try {
    const { count, error: contractError } = await supabase
      .from("deals")
      .select("notion_page_id", { count: "exact", head: true })
      .eq("revenue_tier", "signed");
    if (contractError) {
      errors.push({ stage: "contract", message: contractError.message });
    } else {
      contract = count ?? 0;
    }
  } catch (err) {
    errors.push({
      stage: "contract",
      message: err instanceof Error ? err.message : "supabase query failed",
    });
  }

  return {
    proposal,
    contract,
    derivedAt: new Date().toISOString(),
    errors,
  };
}
