import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getOrgMembers,
  updateMemberRole,
  removeMember,
  countOrgAdmins,
} from "@/lib/queries/organisations";

export async function GET() {
  const session = await requireAuth();
  if (!session.orgId) {
    return NextResponse.json(
      { error: "you are not a member of any organisation" },
      { status: 400 },
    );
  }
  const members = await getOrgMembers(session.orgId);
  return NextResponse.json({ members });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAuth();
  if (!session.orgId || session.orgRole !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { userId, role } = body;
  if (!userId || !role || !["member", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "userId and role (member|admin) are required" },
      { status: 400 },
    );
  }

  if (role === "member") {
    const adminCount = await countOrgAdmins(session.orgId);
    if (adminCount <= 1) {
      const members = await getOrgMembers(session.orgId);
      const target = members.find((m: any) => m.user_id === userId);
      if (target?.role === "admin") {
        return NextResponse.json(
          { error: "cannot demote the last org admin" },
          { status: 400 },
        );
      }
    }
  }

  const result = await updateMemberRole(session.orgId, userId, role);
  if (!result) {
    return NextResponse.json(
      { error: "member not found in this organisation" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, role: result.role });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth();
  if (!session.orgId || session.orgRole !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (userId === session.userId) {
    return NextResponse.json(
      { error: "you cannot remove yourself from the organisation" },
      { status: 400 },
    );
  }

  const members = await getOrgMembers(session.orgId);
  const target = members.find((m: any) => m.user_id === userId);
  if (!target) {
    return NextResponse.json(
      { error: "member not found in this organisation" },
      { status: 404 },
    );
  }

  const result = await removeMember(session.orgId, userId);
  if (!result) {
    return NextResponse.json({ error: "failed to remove member" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
