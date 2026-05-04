/**
 * Supabase read layer for email_templates.
 *
 * Filter parity with lib/notion/email-templates.ts queryEmailTemplates():
 * - category → direct column match
 * - channel  → direct column match
 * - search   → ILIKE '%value%' on name
 *
 * Phase G.1.3: GET /api/email-templates now reads from Supabase.
 * POST still writes to Notion — source of truth.
 */

import { supabase } from "./client";
import type { EmailTemplate } from "@/lib/notion/types";

// ── types ────────────────────────────────────────────────────────

interface EmailTemplateRow {
  notion_page_id: string;
  name: string;
  subject: string | null;
  body: string | null;
  category: string | null;
  channel: string | null;
  notes: string | null;
  times_used: number;
}

export interface EmailTemplateSupabaseFilters {
  category?: string;
  channel?: string;
  search?: string;
}

export interface EmailTemplateSupabasePagination {
  page?: number;
  pageSize?: number;
}

// ── helpers ──────────────────────────────────────────────────────

function mapRowToEmailTemplate(row: EmailTemplateRow): EmailTemplate {
  return {
    id: row.notion_page_id,
    name: row.name,
    subject: row.subject ?? "",
    body: row.body ?? "",
    category: (row.category as EmailTemplate["category"]) ?? "other",
    channel: (row.channel as EmailTemplate["channel"]) ?? "email",
    notes: row.notes ?? "",
    timesUsed: row.times_used ?? 0,
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, name, subject, body, category, channel, notes, times_used";

// ── query functions ───────────────────────────────────────────────

export async function getEmailTemplatesFromSupabase(
  filters: EmailTemplateSupabaseFilters = {},
  pagination: EmailTemplateSupabasePagination = {},
): Promise<{ data: EmailTemplate[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("email_templates")
    .select(SELECT_COLS, { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.channel)  query = query.eq("channel", filters.channel);
  if (filters.search)   query = query.ilike("name", `%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`[supabase/email-templates] query: ${error.message}`);
  return {
    data: (data as unknown as EmailTemplateRow[]).map(mapRowToEmailTemplate),
    total: count ?? 0,
  };
}

/**
 * Fetch a single email template by its Notion page id.
 */
export async function getEmailTemplateByIdFromSupabase(
  notionPageId: string,
): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from("email_templates")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/email-templates] getById: ${error.message}`);
  }
  return data ? mapRowToEmailTemplate(data as unknown as EmailTemplateRow) : null;
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert an email template. Uses notion_page_id as the conflict target.
 */
export async function upsertEmailTemplateToSupabase(
  notionPageId: string,
  data: Partial<Omit<EmailTemplateRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("email_templates")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/email-templates] upsert: ${error.message}`);
}

/**
 * Increment the times_used counter for a template.
 */
export async function incrementEmailTemplateTimesUsedInSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_template_times_used", { p_notion_page_id: notionPageId });
  if (error) {
    // Fallback: fetch + update if RPC not available
    const { data: row, error: fetchErr } = await supabase
      .from("email_templates")
      .select("times_used")
      .eq("notion_page_id", notionPageId)
      .single();
    if (fetchErr) throw new Error(`[supabase/email-templates] incrementTimesUsed fetch: ${fetchErr.message}`);
    const current = (row as { times_used: number } | null)?.times_used ?? 0;
    const { error: updateErr } = await supabase
      .from("email_templates")
      .update({ times_used: current + 1 })
      .eq("notion_page_id", notionPageId);
    if (updateErr) throw new Error(`[supabase/email-templates] incrementTimesUsed update: ${updateErr.message}`);
  }
}

/**
 * Delete an email template row.
 */
export async function deleteEmailTemplateFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/email-templates] delete: ${error.message}`);
}
