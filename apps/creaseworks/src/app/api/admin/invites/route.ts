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
  createInvite,
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

  const invite = await createInvite(email, tier, session.userId, note, expiresAt);

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
