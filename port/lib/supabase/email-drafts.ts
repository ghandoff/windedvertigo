/**
 * Supabase read layer for email_drafts.
 *
 * Returns the canonical Notion `EmailDraft` type so all existing components
 * work without modification.
 *
 * `id` is set to `notion_page_id` (not UUID) so callers that match
 * against Notion relation arrays continue to work unchanged.
 */

import { supabase } from "./client";
import type { EmailDraft, EmailDraftStatus } from "@/lib/notion/types";

interface EmailDraftRow {
  notion_page_id: string;
  org_id: string | null;
  contact_id: string | null;
  campaign_id: string | null;
  step_id: string | null;
  subject: string;
  body: string;
  status: string;
  sent_at: string | null;
  sent_to: string;
  resend_message_id: string;
  opens: number;
  clicks: number;
  machine_opens: number;
  created_at: string | null;
  updated_at: string | null;
}

function mapRowToEmailDraft(row: EmailDraftRow): EmailDraft {
  return {
    id: row.notion_page_id,
    organizationId: row.org_id ?? "",
    contactId: row.contact_id ?? null,
    campaignId: row.campaign_id ?? null,
    stepId: row.step_id ?? null,
    subject: row.subject,
    body: row.body,
    status: row.status as EmailDraftStatus,
    sentAt: row.sent_at ?? null,
    sentTo: row.sent_to,
    resendMessageId: row.resend_message_id,
    opens: row.opens,
    clicks: row.clicks,
    machineOpens: row.machine_opens,
    createdTime: row.created_at ?? "",
    lastEditedTime: row.updated_at ?? "",
  };
}

const SELECT_COLS =
  "notion_page_id, org_id, contact_id, campaign_id, step_id, subject, body, status, sent_at, sent_to, resend_message_id, opens, clicks, machine_opens, created_at, updated_at";

/**
 * Fetch a single email draft by its Notion page id.
 */
export async function getEmailDraftFromSupabase(
  notionPageId: string,
): Promise<EmailDraft | null> {
  const { data, error } = await supabase
    .from("email_drafts")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/email-drafts] getById: ${error.message}`);
  }
  return data ? mapRowToEmailDraft(data as EmailDraftRow) : null;
}

/**
 * Query email drafts by status (replaces queryEmailDrafts({ status }, { pageSize })).
 * If no status is provided, returns all drafts.
 */
export async function getEmailDraftsByStatusFromSupabase(
  status?: EmailDraftStatus,
  pageSize = 50,
): Promise<{ data: EmailDraft[] }> {
  let query = supabase
    .from("email_drafts")
    .select(SELECT_COLS)
    .order("sent_at", { ascending: false })
    .limit(pageSize);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(`[supabase/email-drafts] getByStatus: ${error.message}`);
  return { data: (data as EmailDraftRow[]).map(mapRowToEmailDraft) };
}

/**
 * Fetch ALL email drafts for a campaign (replaces queryEmailDraftsByCampaign).
 */
export async function getEmailDraftsByCampaignFromSupabase(
  campaignId: string,
): Promise<EmailDraft[]> {
  const { data, error } = await supabase
    .from("email_drafts")
    .select(SELECT_COLS)
    .eq("campaign_id", campaignId)
    .order("sent_at", { ascending: false });

  if (error) throw new Error(`[supabase/email-drafts] getByCampaign: ${error.message}`);
  return (data as EmailDraftRow[]).map(mapRowToEmailDraft);
}

/**
 * Fetch email drafts for an organisation (replaces queryEmailDraftsByOrg).
 */
export async function getEmailDraftsByOrgFromSupabase(
  orgId: string,
  pageSize = 50,
): Promise<{ data: EmailDraft[] }> {
  const { data, error } = await supabase
    .from("email_drafts")
    .select(SELECT_COLS)
    .eq("org_id", orgId)
    .order("sent_at", { ascending: false })
    .limit(pageSize);

  if (error) throw new Error(`[supabase/email-drafts] getByOrg: ${error.message}`);
  return { data: (data as EmailDraftRow[]).map(mapRowToEmailDraft) };
}

/**
 * Upsert an email draft. Uses notion_page_id as the conflict target.
 * Used by the sync cron and write path (increment ops, etc.).
 */
export async function upsertEmailDraftToSupabase(
  notionPageId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("email_drafts")
    .upsert(
      { notion_page_id: notionPageId, ...updates },
      { onConflict: "notion_page_id" },
    );
  if (error) throw new Error(`[supabase/email-drafts] upsert: ${error.message}`);
}
