/**
 * GET /api/rfp-radar/[id]/requirements
 *
 * List all extracted + human-edited requirements for this RFP, grouped
 * naturally by kind. Powers the verification-gate UI on the detail page.
 *
 * Returns: { requirements: RfpRequirement[], readiness: { ready, reason, unapprovedCount } }
 *
 * `readiness` is the same check the proposal-generation trigger uses, so the
 * UI can preview whether "Generate" will be enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getRequirementsByRfp,
  isRfpReadyForGeneration,
} from "@/lib/supabase/rfp-requirements";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [requirements, readiness] = await Promise.all([
      getRequirementsByRfp(id),
      isRfpReadyForGeneration(id),
    ]);
    return NextResponse.json({ requirements, readiness });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "fetch failed", detail: msg }, { status: 500 });
  }
}
