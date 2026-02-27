/**
 * API route: /api/partner/keys/[id]
 *
 * DELETE — revoke a partner API key (org admin only)
 *
 * Requires Clerk authentication (requireOrgAdmin).
 * The key ID must belong to the authenticated org.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { revokePartnerKey } from "@/lib/queries/partner-keys";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireOrgAdmin();
  const keyId = params.id;

  if (!keyId || typeof keyId !== "string") {
    return NextResponse.json(
      { error: "invalid key id" },
      { status: 400 },
    );
  }

  try {
    const success = await revokePartnerKey(keyId, session.orgId!);

    if (!success) {
      return NextResponse.json(
        { error: "key not found or already revoked" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { message: "key revoked successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("[partner-keys-id] DELETE error:", error);
    return NextResponse.json(
      { error: "failed to revoke key" },
      { status: 500 },
    );
  }
}
