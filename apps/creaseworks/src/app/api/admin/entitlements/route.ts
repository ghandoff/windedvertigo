/**
 * Admin API: grant entitlements to organisations.
 *
 * POST /api/admin/entitlements
 * Body: { orgId: string, packCacheId: string, trialDays?: number }
 *
 * Session 11: added optional trialDays for free trial grants.
 * When provided, sets expires_at to trialDays from now.
 * checkEntitlement already respects expires_at.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { grantEntitlement, revokeEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  // Audit-2 H2: wrap req.json() in try/catch to return 400 on malformed JSON
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { orgId, packCacheId, trialDays } = body;

  if (!orgId || !packCacheId) {
    return NextResponse.json(
      { error: "orgId and packCacheId are required" },
      { status: 400 },
    );
  }

  // Session 11: compute expires_at from optional trialDays param.
  // e.g. trialDays=14 sets a 14-day free trial entitlement.
  let expiresAt: string | null = null;
  if (trialDays && typeof trialDays === "number" && trialDays > 0) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + trialDays);
    expiresAt = expiry.toISOString();
  }

  const result = await grantEntitlement(orgId, packCacheId, null, expiresAt);

  // audit log (M1: capture IP)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    null,
    null,
    packCacheId,
    "admin_grant_entitlement",
    ip,
    [`org_id:${orgId}`, ...(expiresAt ? [`trial_expires:${expiresAt}`] : [])],
  );

  return NextResponse.json({
    success: true,
    entitlementId: result.id,
    ...(expiresAt ? { expiresAt } : {}),
  }, { status: 201 });
}

/**
 * DELETE /api/admin/entitlements
 * Body: { orgId: string, packCacheId: string }
 *
 * Soft-revokes an entitlement (sets revoked_at = NOW()).
 */
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  // Audit-2 H2: wrap req.json() in try/catch to return 400 on malformed JSON
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { orgId, packCacheId } = body;

  if (!orgId || !packCacheId) {
    return NextResponse.json(
      { error: "orgId and packCacheId are required" },
      { status: 400 },
    );
  }

  await revokeEntitlement(orgId, packCacheId);

  // audit log (M1: capture IP)
  const ipDel = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    null,
    null,
    packCacheId,
    "admin_revoke_entitlement",
    ipDel,
    [`org_id:${orgId}`],
  );

  return NextResponse.json({ success: true }, { status: 200 });
}
