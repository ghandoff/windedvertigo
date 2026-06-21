/**
 * GET  /api/partners — list partners (optional ?type=&relationship=&country=)
 * POST /api/partners — create a new partner
 */

import { NextRequest } from "next/server";
import {
  getPartners,
  createPartner,
  type PartnerFilters,
  type PartnerType,
  type PartnerRelationship,
} from "@/lib/supabase/rfp-partners";
import { json, error, param } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const filters: PartnerFilters = {};
  const country      = param(req, "country");
  const type         = param(req, "type");
  const relationship = param(req, "relationship");

  if (country)      filters.country      = country;
  if (type)         filters.type         = type as PartnerType;
  if (relationship) filters.relationship = relationship as PartnerRelationship;

  try {
    const data = await getPartners(filters);
    return json({ data, total: data.length });
  } catch (err) {
    console.error("[api/partners] GET failed:", err);
    return error("failed to load partners", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");

  try {
    const partner = await createPartner({
      name:         body.name,
      country:      body.country ?? null,
      type:         body.type ?? "local",
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : null,
      relationship: body.relationship ?? "known",
      contactName:  body.contactName ?? null,
      contactEmail: body.contactEmail ?? null,
      notes:        body.notes ?? null,
    });
    return json(partner, 201);
  } catch (err) {
    console.error("[api/partners] POST failed:", err);
    return error("failed to create partner", 500);
  }
}
