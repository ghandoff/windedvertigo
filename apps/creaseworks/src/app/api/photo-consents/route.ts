/**
 * API route: /api/photo-consents
 *
 * POST — create a photo consent record for an evidence item.
 *
 * Phase 4 — engagement system (COPPA 2025 three-tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { createPhotoConsent } from "@/lib/queries/photo-consents";
import { awardCredit, CREDIT_VALUES } from "@/lib/queries/credits";
import { parseJsonBody } from "@/lib/api-helpers";

const VALID_TIERS = new Set(["artifact", "activity", "face"]);

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed as Record<string, unknown>;

  const { runEvidenceId, consentTier, marketingApproved, parentName, childAgeRange } = body;

  // Validate required fields
  if (!runEvidenceId || typeof runEvidenceId !== "string") {
    return NextResponse.json({ error: "runEvidenceId is required" }, { status: 400 });
  }
  if (!consentTier || typeof consentTier !== "string" || !VALID_TIERS.has(consentTier)) {
    return NextResponse.json(
      { error: "consentTier must be one of: artifact, activity, face" },
      { status: 400 },
    );
  }

  // Face-tier requires parent name and child age range
  if (consentTier === "face") {
    if (!parentName || typeof parentName !== "string" || !parentName.trim()) {
      return NextResponse.json({ error: "parentName is required for face-tier consent" }, { status: 400 });
    }
    if (!childAgeRange || typeof childAgeRange !== "string") {
      return NextResponse.json({ error: "childAgeRange is required for face-tier consent" }, { status: 400 });
    }
  }

  try {
    // Capture IP for waiver audit trail
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    const consentId = await createPhotoConsent({
      runEvidenceId: runEvidenceId as string,
      userId: session.userId,
      consentTier: consentTier as "artifact" | "activity" | "face",
      marketingApproved: marketingApproved === true,
      parentName: typeof parentName === "string" ? parentName.trim() : null,
      childAgeRange: typeof childAgeRange === "string" ? childAgeRange : null,
      waiverIp: ip,
    });

    // Award marketing consent credit if opted in (fire-and-forget)
    if (marketingApproved === true) {
      awardCredit(
        session.userId,
        session.orgId,
        CREDIT_VALUES.marketing_consent,
        "marketing_consent",
      ).catch(() => {});
    }

    return NextResponse.json({ id: consentId }, { status: 201 });
  } catch (err: unknown) {
    console.error("create photo consent error:", err);
    return NextResponse.json({ error: "failed to create photo consent" }, { status: 500 });
  }
}
