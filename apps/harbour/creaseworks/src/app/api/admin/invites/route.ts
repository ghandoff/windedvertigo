/**
 * API route: /api/admin/invites
 *
 * POST   — create complimentary invite(s) and send email(s)
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
import { sendInviteEmail } from "@/lib/email/send-invite";
import { sql } from "@/lib/db";

const VALID_TIERS = ["explorer", "practitioner"];

/* ── POST: create invite(s) ── */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed as Record<string, unknown>;

  // Accept `emails` (array) or `email` (string) for backward compat
  let rawEmails: string[];
  if (Array.isArray(body.emails)) {
    rawEmails = (body.emails as string[]).map((e) => String(e).trim().toLowerCase());
  } else {
    rawEmails = [((body.email as string) ?? "").trim().toLowerCase()];
  }

  // Validate: filter to valid emails
  const emails = rawEmails.filter((e) => e && e.includes("@"));
  if (emails.length === 0) {
    return NextResponse.json(
      { error: "at least one valid email is required" },
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

  // Look up pack names for the email template
  let packNames: string[] = [];
  try {
    const packRows = await sql.query(
      `SELECT title FROM packs_cache WHERE id = ANY($1)`,
      [packIds],
    );
    packNames = packRows.rows.map((r: { title: string }) => r.title);
  } catch {
    packNames = [`${packIds.length} pack${packIds.length !== 1 ? "s" : ""}`];
  }

  // Get inviter's display name for the email (CWSession has no name field)
  const inviterName: string | null = null;

  // Process each email: create invite + send email
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const email of emails) {
    try {
      await createInviteWithPacks(
        email,
        tier,
        session.userId,
        packIds,
        note,
        expiresAt,
      );

      // Send the invite email (best-effort — invite is created regardless)
      const emailResult = await sendInviteEmail({
        to: email,
        packNames,
        note: note ?? null,
        inviterName,
      });

      results.push({
        email,
        success: true,
        error: emailResult.success ? undefined : `invite created, email failed: ${emailResult.error}`,
      });
    } catch (err: any) {
      results.push({
        email,
        success: false,
        error: err.message || "failed to create invite",
      });
    }
  }

  return NextResponse.json({ success: true, results });
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
