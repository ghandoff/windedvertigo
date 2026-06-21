/**
 * PATCH  /api/partners/[id] — update a partner
 * DELETE /api/partners/[id] — delete a partner
 */

import { NextRequest } from "next/server";
import {
  getPartner,
  updatePartner,
  deletePartner,
  type PartnerType,
  type PartnerRelationship,
} from "@/lib/supabase/rfp-partners";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const partner = await getPartner(id);
    if (!partner) return error("partner not found", 404);
    return json(partner);
  } catch (err) {
    console.error("[api/partners/[id]] GET failed:", err);
    return error("failed to load partner", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return error("invalid request body");

  try {
    const patch: Parameters<typeof updatePartner>[1] = {};
    if (body.name         !== undefined) patch.name         = body.name;
    if (body.country      !== undefined) patch.country      = body.country;
    if (body.type         !== undefined) patch.type         = body.type as PartnerType;
    if (body.capabilities !== undefined) patch.capabilities = body.capabilities;
    if (body.relationship !== undefined) patch.relationship = body.relationship as PartnerRelationship;
    if (body.contactName  !== undefined) patch.contactName  = body.contactName;
    if (body.contactEmail !== undefined) patch.contactEmail = body.contactEmail;
    if (body.notes        !== undefined) patch.notes        = body.notes;

    const updated = await updatePartner(id, patch);
    return json(updated);
  } catch (err) {
    console.error("[api/partners/[id]] PATCH failed:", err);
    return error("failed to update partner", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deletePartner(id);
    return json({ deleted: true });
  } catch (err) {
    console.error("[api/partners/[id]] DELETE failed:", err);
    return error("failed to delete partner", 500);
  }
}
