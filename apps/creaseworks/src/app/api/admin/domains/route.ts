/**
 * Admin API: domain blocklist CRUD.
 *
 * GET    /api/admin/domains          â list all blocked domains
 * POST   /api/admin/domains          â add a domain { domain, reason? }
 * PATCH  /api/admin/domains          â toggle or update { id, enabled?, reason? }
 * DELETE /api/admin/domains          â remove a domain { id }
 *
 * MVP 4 â admin pages and rate limiting.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAccess } from "@/lib/queries/audit";
import {
  getAllBlockedDomains,
  addBlockedDomain,
  toggleBlockedDomain,
  updateBlockedDomainReason,
  deleteBlockedDomain,
} from "@/lib/queries/admin";

export async function GET() {
  await requireAdmin();
  const domains = await getAllBlockedDomains();
  return NextResponse.json({ domains }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  // Audit-2 H2: wrap req.json() in try/catch to return 400 on malformed JSON
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const { domain, reason } = body;

  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const result = await addBlockedDomain(domain, reason ?? null, session.userId);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(session.userId, null, null, null, "admin_add_blocked_domain", ip, [
    `domain:${domain}`,
  ]);

  return NextResponse.json({ success: true, domain: result }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  // Audit-2 H2: wrap req.json() in try/catch to return 400 on malformed JSON
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const { id, enabled, reason } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (typeof enabled === "boolean") {
    await toggleBlockedDomain(id, enabled);
  }
  if (typeof reason === "string") {
    await updateBlockedDomainReason(id, reason);
  }

  const ipPatch = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(session.userId, null, null, null, "admin_update_blocked_domain", ipPatch, [
    `id:${id}`,
  ]);

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  // Audit-2 H2: wrap req.json() in try/catch to return 400 on malformed JSON
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await deleteBlockedDomain(id);

  const ipDel = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(session.userId, null, null, null, "admin_delete_blocked_domain", ipDel, [
    `id:${id}`,
  ]);

  return NextResponse.json({ success: true }, { status: 200 });
}
