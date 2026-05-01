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
