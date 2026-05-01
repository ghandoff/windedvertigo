/**
 * Partner API authentication — validate Bearer token and scope checking.
 *
 * Partner endpoints require a valid partner API key in the Authorization header.
 * Format: Authorization: Bearer cw_pk_...
 */

import { NextRequest, NextResponse } from "next/server";
import { validatePartnerKey } from "@/lib/queries/partner-keys";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface PartnerContext {
  orgId: string;
  scopes: string[];
}

/* ------------------------------------------------------------------ */
/*  auth middleware                                                    */
/* ------------------------------------------------------------------ */

/**
 * Validate partner API key from Authorization header.
 * Returns PartnerContext on success, or 401/403 response on failure.
 *
 * Usage:
 *   const auth = await requirePartnerAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const { orgId, scopes } = auth;
 */
export async function requirePartnerAuth(
  req: NextRequest,
): Promise<PartnerContext | NextResponse> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return NextResponse.json(
      { error: "missing Authorization header" },
      { status: 401 },
    );
  }

  // Extract Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return NextResponse.json(
      { error: "invalid Authorization header format" },
      { status: 401 },
    );
  }

  const apiKey = parts[1];

  // Validate key
  const validation = await validatePartnerKey(apiKey);

  if (!validation) {
    return NextResponse.json(
      { error: "invalid or revoked API key" },
      { status: 401 },
    );
  }

  return {
    orgId: validation.orgId,
    scopes: validation.scopes,
  };
}

/* ------------------------------------------------------------------ */
/*  scope checking                                                     */
/* ------------------------------------------------------------------ */

/**
 * Check if a partner context has a required scope.
 */
export function requireScope(context: PartnerContext, scope: string): boolean {
  return context.scopes.includes(scope);
}
