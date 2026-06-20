import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import {
  upsertPortalRegistration,
  deletePortalRegistration,
  type PortalStatus,
} from "@/lib/supabase/rfp-portal-registrations";

const VALID_STATUSES = new Set<PortalStatus>(["registered", "pending", "blocked", "not-required"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return error("unauthorized", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.portalName?.trim()) return error("portalName is required");
  if (!body?.status || !VALID_STATUSES.has(body.status)) {
    return error("status must be one of: registered, pending, blocked, not-required");
  }

  const registration = await upsertPortalRegistration(
    id,
    body.portalName.trim(),
    body.status as PortalStatus,
    body.notes ?? null,
  );
  return json(registration);
}

export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return error("unauthorized", 401);

  const { registrationId } = await req.json().catch(() => ({}));
  if (!registrationId) return error("registrationId is required");

  await deletePortalRegistration(registrationId);
  return json({ ok: true });
}
