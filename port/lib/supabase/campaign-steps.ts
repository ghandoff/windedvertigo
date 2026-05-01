/**
 * Supabase read layer for campaign steps.
 *
 * `id` is set to `notion_page_id` (not UUID) so relation matching works.
 */

import { supabase } from "./client";

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

export interface CampaignStepFromSupabase {
  id: string;
  name: string;
  campaignIds: string[];
  stepNumber: number | null;
  channel: string | null;
  subject: string | null;
  body: string | null;
  delayDays: number | null;
  sendDate: string | null;
  status: string | null;
  sentCount: number | null;
  skippedCount: number | null;
  failedCount: number | null;
}

function mapRowToStep(row: CampaignStepRow): CampaignStepFromSupabase {
  return {
    id: row.notion_page_id,
    name: row.name,
    campaignIds: row.campaign_ids ?? [],
    stepNumber: row.step_number,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    delayDays: row.delay_days,
    sendDate: row.send_date,
    status: row.status,
    sentCount: row.sent_count,
    skippedCount: row.skipped_count,
    failedCount: row.failed_count,
  };
}

const SELECT_COLS =
  "notion_page_id, name, campaign_ids, step_number, channel, subject, body, delay_days, send_date, status, sent_count, skipped_count, failed_count";

export async function getCampaignStepsFromSupabase(
  campaignId?: string,
): Promise<CampaignStepFromSupabase[]> {
  let query = supabase
    .from("campaign_steps")
    .select(SELECT_COLS)
    .order("step_number", { ascending: true });

  if (campaignId) query = query.contains("campaign_ids", [campaignId]);

  const { data, error } = await query;
  if (error) throw new Error(`[supabase/campaign-steps] getCampaignSteps: ${error.message}`);
  return (data as CampaignStepRow[]).map(mapRowToStep);
}
