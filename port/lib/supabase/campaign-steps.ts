/**
 * Supabase read layer for campaign steps.
 *
 * Returns the canonical Notion `CampaignStep` type so all existing
 * components work without modification.
 *
 * `id` is set to `notion_page_id` (not UUID) so relation matching works.
 */

import { supabase } from "./client";
import type { CampaignStep, StepChannel, StepStatus } from "@/lib/notion/types";

interface CampaignStepRow {
  notion_page_id: string;
  name: string;
  campaign_ids: string[] | null;
  step_number: number | null;
  channel: string | null;
  subject: string | null;
  body: string | null;
  delay_days: number | null;
  send_date: string | null;
  status: string | null;
  sent_count: number | null;
  skipped_count: number | null;
  failed_count: number | null;
}

function mapRowToStep(row: CampaignStepRow): CampaignStep {
  return {
    id: row.notion_page_id,
    name: row.name,
    campaignIds: row.campaign_ids ?? [],
    stepNumber: row.step_number,
    channel: (row.channel as StepChannel) ?? "email",
    subject: row.subject ?? "",
    body: row.body ?? "",
    delayDays: row.delay_days,
    sendDate: row.send_date ? { start: row.send_date, end: null } : null,
    status: (row.status as StepStatus) ?? "draft",
    variantBSubject: "",
    variantBBody: "",
    condition: "",
    sentCount: row.sent_count,
    skippedCount: row.skipped_count,
    failedCount: row.failed_count,
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, name, campaign_ids, step_number, channel, subject, body, delay_days, send_date, status, sent_count, skipped_count, failed_count";

export async function getCampaignStepsFromSupabase(
  campaignId?: string,
): Promise<CampaignStep[]> {
  let query = supabase
    .from("campaign_steps")
    .select(SELECT_COLS)
    .order("step_number", { ascending: true });

  if (campaignId) query = query.contains("campaign_ids", [campaignId]);

  const { data, error } = await query;
  if (error) throw new Error(`[supabase/campaign-steps] getCampaignSteps: ${error.message}`);
  return (data as CampaignStepRow[]).map(mapRowToStep);
}

export async function getCampaignStepByIdFromSupabase(
  notionPageId: string,
): Promise<CampaignStep | null> {
  const { data, error } = await supabase
    .from("campaign_steps")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/campaign-steps] getById: ${error.message}`);
  }
  return data ? mapRowToStep(data as CampaignStepRow) : null;
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert a campaign step. Uses notion_page_id as the conflict target.
 */
export async function upsertCampaignStepToSupabase(
  notionPageId: string,
  data: Partial<Omit<CampaignStepRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("campaign_steps")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/campaign-steps] upsert: ${error.message}`);
}

/**
 * Delete a campaign step row.
 */
export async function deleteCampaignStepFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("campaign_steps")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/campaign-steps] delete: ${error.message}`);
}
