/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getEmailTemplateByIdFromSupabase,
  upsertEmailTemplateToSupabase,
  deleteEmailTemplateFromSupabase,
} from "@/lib/supabase/email-templates";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const template = await getEmailTemplateByIdFromSupabase(id);
    if (!template) return error("Email template not found", 404);
    return json(template);
  } catch (err) {
    console.error("[api/email-templates/[id]] GET failed:", err);
    return error("failed to load email template", 500);
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
    if (body.subject !== undefined) patch.subject = body.subject;
    if (body.body !== undefined) patch.body = body.body;
    if (body.category !== undefined) patch.category = body.category;
    if (body.channel !== undefined) patch.channel = body.channel;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.timesUsed !== undefined) patch.times_used = body.timesUsed;

    await upsertEmailTemplateToSupabase(id, patch);

    const updated = await getEmailTemplateByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/email-templates/[id]] PATCH failed:", err);
    return error("failed to update email template", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteEmailTemplateFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/email-templates/[id]] DELETE failed:", err);
    return error("failed to delete email template", 500);
  }
}
