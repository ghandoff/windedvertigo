/**
 * Phase A3: GET, PATCH, DELETE now use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getContactByIdFromSupabase,
  upsertContactToSupabase,
  deleteContactFromSupabase,
} from "@/lib/supabase/contacts";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const contact = await getContactByIdFromSupabase(id);
    if (!contact) return error("Contact not found", 404);
    return json(contact);
  } catch (err) {
    console.error("[api/contacts/[id]] GET failed:", err);
    return error("failed to load contact", 500);
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
    if (body.name !== undefined) patch.name = body.name;
    if (body.email !== undefined) patch.email = body.email;
    if (body.role !== undefined) patch.role = body.role;
    if (body.organizationIds !== undefined) patch.org_id = body.organizationIds?.[0] ?? null;
    if (body.contactType !== undefined) patch.contact_type = body.contactType;
    if (body.relationshipStage !== undefined) patch.relationship_stage = body.relationshipStage;
    if (body.contactWarmth !== undefined) patch.contact_warmth = body.contactWarmth;
    if (body.responsiveness !== undefined) patch.responsiveness = body.responsiveness;
    if (body.referralPotential !== undefined) patch.referral_potential = body.referralPotential;
    if (body.lastContacted !== undefined) patch.last_contacted = body.lastContacted?.start ?? null;
    if (body.profilePhotoUrl !== undefined) patch.profile_photo_url = body.profilePhotoUrl;
    if (body.linkedin !== undefined) patch.linkedin = body.linkedin;

    await upsertContactToSupabase(id, patch);

    const updated = await getContactByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/contacts/[id]] PATCH failed:", err);
    return error("failed to update contact", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteContactFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/contacts/[id]] DELETE failed:", err);
    return error("failed to delete contact", 500);
  }
}
