/**
 * Phase A3: PATCH and DELETE now write to Supabase directly.
 * GET reads from Supabase by id.
 */
import { NextRequest } from "next/server";
import {
  getOrganizationByIdFromSupabase,
  upsertOrganizationToSupabase,
  deleteOrganizationFromSupabase,
} from "@/lib/supabase/organizations";
import { json, error } from "@/lib/api-helpers";
import { deriveRelationship, computePriority } from "@/lib/notion/derived-fields";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const org = await getOrganizationByIdFromSupabase(id);
    if (!org) return error("Organization not found", 404);
    return json(org);
  } catch (err) {
    console.error("[api/organizations/[id]] GET failed:", err);
    return error("failed to load organization", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  try {
    // Fetch current state to merge derived fields correctly
    const current = await getOrganizationByIdFromSupabase(id);

    const connection = body.connection ?? current?.connection ?? "";
    const outreachStatus = body.outreachStatus ?? current?.outreachStatus ?? "";
    const friendship = body.friendship ?? current?.friendship ?? "";
    const fitRating = body.fitRating ?? current?.fitRating ?? "";
    const relationship = body.relationship || deriveRelationship(connection, outreachStatus, friendship);
    const derivedPriority = computePriority(fitRating, relationship);

    const patch: Record<string, unknown> = {};
    if (body.organization !== undefined) patch.name = body.organization;
    if (body.connection !== undefined) patch.connection = body.connection;
    if (body.type !== undefined) patch.type = body.type;
    if (body.category !== undefined) patch.category = Array.isArray(body.category) ? body.category.join(", ") : body.category;
    if (body.regions !== undefined) patch.regions = Array.isArray(body.regions) ? body.regions.join(", ") : body.regions;
    if (body.source !== undefined) patch.source = body.source;
    if (body.website !== undefined) patch.website = body.website;
    if (body.email !== undefined) patch.email = body.email;
    if (body.outreachStatus !== undefined) patch.outreach_status = body.outreachStatus;
    if (body.friendship !== undefined) patch.friendship = body.friendship;
    if (body.fitRating !== undefined) patch.fit_rating = body.fitRating;
    if (body.marketSegment !== undefined) patch.market_segment = body.marketSegment;
    if (body.quadrant !== undefined) patch.quadrant = body.quadrant;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.logo !== undefined) patch.logo = body.logo;
    if (body.description !== undefined) patch.description = body.description;
    if (body.linkedinUrl !== undefined) patch.linkedin_url = body.linkedinUrl;
    if (body.enrichedAt !== undefined) patch.enriched_at = body.enrichedAt;

    // Always recompute derived fields when any of their inputs change
    patch.derived_priority = derivedPriority;

    await upsertOrganizationToSupabase(id, patch);

    // Return updated record
    const updated = await getOrganizationByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/organizations/[id]] PATCH failed:", err);
    return error("failed to update organization", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteOrganizationFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/organizations/[id]] DELETE failed:", err);
    return error("failed to delete organization", 500);
  }
}
