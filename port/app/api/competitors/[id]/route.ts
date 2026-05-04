/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getCompetitorByIdFromSupabase,
  upsertCompetitorToSupabase,
  deleteCompetitorFromSupabase,
} from "@/lib/supabase/competitors";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const comp = await getCompetitorByIdFromSupabase(id);
    if (!comp) return error("Competitor not found", 404);
    return json(comp);
  } catch (err) {
    console.error("[api/competitors/[id]] GET failed:", err);
    return error("failed to load competitor", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  try {
    const patch: Record<string, unknown> = {};
    if (body.organisation !== undefined) patch.organisation = body.organisation;
    if (body.type !== undefined) patch.type = body.type;
    if (body.threatLevel !== undefined) patch.threat_level = body.threatLevel;
    if (body.quadrantOverlap !== undefined) patch.quadrant_overlap = body.quadrantOverlap;
    if (body.geography !== undefined) patch.geography = body.geography;
    if (body.whatTheyOffer !== undefined) patch.what_they_offer = body.whatTheyOffer;
    if (body.whereWvWins !== undefined) patch.where_wv_wins = body.whereWvWins;
    if (body.relevanceToWv !== undefined) patch.relevance_to_wv = body.relevanceToWv;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.url !== undefined) patch.url = body.url;
    if (body.organizationIds !== undefined) patch.organization_ids = body.organizationIds;
    patch.updated_at = new Date().toISOString();

    await upsertCompetitorToSupabase(id, patch);

    const updated = await getCompetitorByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/competitors/[id]] PATCH failed:", err);
    return error("failed to update competitor", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteCompetitorFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/competitors/[id]] DELETE failed:", err);
    return error("failed to delete competitor", 500);
  }
}
