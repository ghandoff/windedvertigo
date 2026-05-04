/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */

import { NextRequest } from "next/server";
import {
  getEmailTemplatesFromSupabase,
  upsertEmailTemplateToSupabase,
  type EmailTemplateSupabaseFilters,
} from "@/lib/supabase/email-templates";
import { json, error, param } from "@/lib/api-helpers";

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

  try {
    const id = crypto.randomUUID();
    await upsertEmailTemplateToSupabase(id, {
      name: body.name,
      subject: body.subject ?? null,
      body: body.body ?? null,
      category: body.category ?? null,
      channel: body.channel ?? null,
      notes: body.notes ?? null,
      times_used: 0,
    });

    return json({
      id,
      name: body.name,
      subject: body.subject ?? "",
      body: body.body ?? "",
      category: body.category ?? "other",
      channel: body.channel ?? "email",
      notes: body.notes ?? "",
      timesUsed: 0,
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/email-templates] POST failed:", err);
    return error("failed to create email template", 500);
  }
}
