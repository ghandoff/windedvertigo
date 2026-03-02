/**
 * API route: /api/admin/invites
 *
 * POST   — create a complimentary invite
 * DELETE — revoke an invite
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseJsonBody } from "@/lib/api-helpers";
import {
  createInviteWithPacks,
  listAllInvites,
  revokeInvite,
} from "@/lib/queries/invites";

const VALID_TIERS = ["explorer", "practitioner"];

/* ── POST: create invite ── */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed as Record<string, unknown>;

  const email = ((body.email as string) ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "a valid email is required" },
      { status: 400 },
    );
  }

  const tier = VALID_TIERS.includes(body.tier as string)
    ? (body.tier as "explorer" | "practitioner")
    : "explorer";

  const note = body.note ? String(body.note).slice(0, 200) : undefined;

  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + Number(body.expiresInDays) * 86400000)
    : undefined;

  // Pack IDs selected by admin — determines which packs the invitee gets access to
  const packIds = Array.isArray(body.packIds)
    ? (body.packIds as string[]).filter((id) => typeof id === "string" && id.length > 0)
    : [];

  if (packIds.length === 0) {
    return NextResponse.json(
      { error: "at least one pack must be selected" },
      { status: 400 },
    );
  }

  const invite = await createInviteWithPacks(
    email,
    tier,
    session.userId,
    packIds,
    note,
    expiresAt,
  );

  return NextResponse.json({ success: true, invite });
}

/* ── GET: list all invites ── */
export async function GET() {
  await requireAdmin();
  const invites = await listAllInvites();
  return NextResponse.json({ invites });
}

/* ── DELETE: revoke invite ── */
export async function DELETE(req: NextRequest) {
  await requireAdmin();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed as Record<string, unknown>;

  const inviteId = (body.inviteId as string) ?? "";
  if (!inviteId) {
    return NextResponse.json(
      { error: "inviteId is required" },
      { status: 400 },
    );
  }

  await revokeInvite(inviteId);
  return NextResponse.json({ success: true });
}
