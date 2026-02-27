/**
 * Admin API: admin allowlist management.
 *
 * GET    /api/admin/admins    — list all admins
 * POST   /api/admin/admins    — add admin by email { email }
 * DELETE /api/admin/admins    — remove admin { id }
 *
 * MVP 4 — admin pages and rate limiting.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAccess } from "@/lib/queries/audit";
import { parseJsonBody } from "@/lib/api-helpers";
import {
  getAllAdmins,
  addAdminByEmail,
  removeAdmin,
  countAdmins,
} from "@/lib/queries/admin";

export async function GET() {
  await requireAdmin();
  const admins = await getAllAdmins();
  return NextResponse.json({ admins }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const { email } = parsed as Record<string, unknown>;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const result = await addAdminByEmail(email, session.userId);

  if (!result) {
    return NextResponse.json(
      { error: "user not found — they must sign in at least once before being added as admin" },
      { status: 404 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(session.userId, null, null, null, "admin_add_admin", ip, [
    `email:${email}`,
  ]);

  return NextResponse.json({ success: true, admin: result }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  const delResult = await parseJsonBody(req);
  if (delResult instanceof NextResponse) return delResult;
  const { id } = delResult as Record<string, unknown>;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // prevent removing the last admin
  const total = await countAdmins();
  if (total <= 1) {
    return NextResponse.json(
      { error: "cannot remove the last admin" },
      { status: 400 },
    );
  }

  await removeAdmin(id);

  const ipDel = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(session.userId, null, null, null, "admin_remove_admin", ipDel, [
    `id:${id}`,
  ]);

  return NextResponse.json({ success: true }, { status: 200 });
}
