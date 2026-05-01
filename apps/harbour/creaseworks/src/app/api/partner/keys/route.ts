/**
 * API route: /api/partner/keys
 *
 * GET  — list all partner API keys for the authenticated org (org admin only)
 * POST — create a new partner API key (org admin only)
 *
 * Requires Clerk authentication (requireOrgAdmin).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { createPartnerKey, listPartnerKeys } from "@/lib/queries/partner-keys";
import { parseJsonBody } from "@/lib/api-helpers";

/* ------------------------------------------------------------------ */
/*  GET — list keys                                                    */
/* ------------------------------------------------------------------ */

export async function GET() {
  const session = await requireOrgAdmin();

  try {
    const keys = await listPartnerKeys(session.orgId!);
    return NextResponse.json({ data: keys });
  } catch (error) {
    console.error("[partner-keys] GET error:", error);
    return NextResponse.json(
      { error: "failed to fetch keys" },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create key                                                  */
/* ------------------------------------------------------------------ */

interface CreateKeyRequest {
  label: string;
  scopes?: string[];
}

export async function POST(req: NextRequest) {
  const session = await requireOrgAdmin();

  // Parse request body
  const bodyResult = await parseJsonBody<CreateKeyRequest>(req);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const { label, scopes } = bodyResult;

  // Validate label
  if (!label || typeof label !== "string" || label.trim().length === 0) {
    return NextResponse.json(
      { error: "label is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  // Validate scopes if provided
  if (scopes !== undefined) {
    if (!Array.isArray(scopes) || !scopes.every((s) => typeof s === "string")) {
      return NextResponse.json(
        { error: "scopes must be an array of strings" },
        { status: 400 },
      );
    }
  }

  try {
    const { key, fullKey } = await createPartnerKey(session.orgId!, label.trim(), scopes);
    return NextResponse.json(
      {
        data: key,
        fullKey,
        message: "This is the only time the full key will be displayed. Store it securely.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[partner-keys] POST error:", error);
    return NextResponse.json(
      { error: "failed to create key" },
      { status: 500 },
    );
  }
}
