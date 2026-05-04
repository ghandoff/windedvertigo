/**
 * GET /api/contacts — list + filter contacts
 * POST /api/contacts — create a new contact
 *
 * Phase G.1.2: GET reads from Supabase.
 * Phase A3: POST writes to Supabase directly (Notion write retired).
 */

import { NextRequest } from "next/server";
import {
  getContactsFromSupabase,
  upsertContactToSupabase,
  type ContactSupabaseFilters,
} from "@/lib/supabase/contacts";
import { json, error, param, boolParam } from "@/lib/api-helpers";

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

  try {
    const id = crypto.randomUUID();

    await upsertContactToSupabase(id, {
      name: body.name,
      email: body.email ?? null,
      role: body.role ?? null,
      org_id: body.organizationIds?.[0] ?? null,
      contact_type: body.contactType ?? null,
      relationship_stage: body.relationshipStage ?? null,
      contact_warmth: body.contactWarmth ?? null,
      responsiveness: body.responsiveness ?? null,
      referral_potential: body.referralPotential ?? false,
    });

    return json({
      id,
      name: body.name,
      email: body.email ?? "",
      role: body.role ?? "",
      contactType: body.contactType ?? "collaborator",
      contactWarmth: body.contactWarmth ?? "cold",
      responsiveness: body.responsiveness ?? "unknown",
      referralPotential: body.referralPotential ?? false,
      linkedin: "",
      phoneNumber: "",
      profilePhotoUrl: "",
      relationshipStage: body.relationshipStage ?? "stranger",
      lastContacted: null,
      nextAction: "",
      organizationIds: body.organizationIds ?? [],
      nodeUserIds: [],
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/contacts] POST failed:", err);
    return error("failed to create contact", 500);
  }
}
