/**
 * GET /api/contacts — list + filter contacts
 * POST /api/contacts — create a new contact (writes still go to Notion)
 *
 * Phase G.1.2: GET reads from Supabase (faster, no rate limits).
 * POST still writes to Notion — source of truth; sync cron mirrors within 15 min.
 */

import { NextRequest } from "next/server";
import {
  getContactsFromSupabase,
  type ContactSupabaseFilters,
} from "@/lib/supabase/contacts";
import { createContact } from "@/lib/notion/contacts";
import { json, error, param, boolParam, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: ContactSupabaseFilters = {};

  if (param(req, "contactType"))       filters.contactType       = param(req, "contactType");
  if (param(req, "contactWarmth"))     filters.contactWarmth     = param(req, "contactWarmth");
  if (param(req, "responsiveness"))    filters.responsiveness    = param(req, "responsiveness");
  if (param(req, "relationshipStage")) filters.relationshipStage = param(req, "relationshipStage");
  if (param(req, "orgId"))             filters.orgId             = param(req, "orgId");
  if (param(req, "search"))            filters.search            = param(req, "search");
  if (boolParam(req, "referralPotential") !== undefined) {
    filters.referralPotential = boolParam(req, "referralPotential");
  }

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getContactsFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/contacts] Supabase query failed:", err);
    return error("failed to load contacts", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");

  // Creates still go to Notion — source of truth.
  return withNotionError(async () => {
    const contact = await createContact(body);
    return json(contact, 201);
  });
}
