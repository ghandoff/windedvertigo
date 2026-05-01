/**
 * GET /api/email-templates — list + filter email templates
 * POST /api/email-templates — create a new email template (writes still go to Notion)
 *
 * Phase G.1.3: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 15 min.
 */

import { NextRequest } from "next/server";
import {
  getEmailTemplatesFromSupabase,
  type EmailTemplateSupabaseFilters,
} from "@/lib/supabase/email-templates";
import { createEmailTemplate } from "@/lib/notion/email-templates";
import { json, error, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: EmailTemplateSupabaseFilters = {};
  if (param(req, "category")) filters.category = param(req, "category");
  if (param(req, "channel"))  filters.channel  = param(req, "channel");
  if (param(req, "search"))   filters.search   = param(req, "search");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getEmailTemplatesFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/email-templates] Supabase query failed:", err);
    return error("failed to load email templates", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");

  // Creates still go to Notion — source of truth.
  return withNotionError(async () => {
    const template = await createEmailTemplate(body);
    return json(template, 201);
  });
}
