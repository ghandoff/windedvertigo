/**
 * POST /api/matcher — public playdate matching endpoint.
 *
 * Accepts materials, forms, slots, and context filters.
 * Returns ranked playdates with scores and coverage details.
 * Entitled fields (substitutionsNotes, findAgainMode) are only
 * populated when the caller's org owns the relevant pack.
 *
 * MVP 3 — matcher.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { logAccess } from "@/lib/queries/audit";
import { performMatching, type MatcherInput } from "@/lib/queries/matcher";
import { parseJsonBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const materials = Array.isArray(body.materials) ? body.materials : [];
  const forms = Array.isArray(body.forms) ? body.forms : [];
  const slots = Array.isArray(body.slots) ? body.slots : [];
  const contexts = Array.isArray(body.contexts) ? body.contexts : [];
  const energyLevels = Array.isArray(body.energyLevels) ? body.energyLevels : [];

  // at least one filter required
  if (
    materials.length === 0 &&
    forms.length === 0 &&
    slots.length === 0 &&
    contexts.length === 0 &&
    energyLevels.length === 0
  ) {
    return NextResponse.json(
      { error: "at least one filter is required (materials, forms, slots, contexts, or energyLevels)" },
      { status: 400 },
    );
  }

  const input: MatcherInput = { materials, forms, slots, contexts, energyLevels };

  // optional auth — matcher is public but entitled users get extra fields
  const session = await getSession();

  const result = await performMatching(input, session);

  // audit log for authenticated users (M1: capture IP)
  if (session) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      null,
      null,
      "matcher_search",
      ip,
      ["materials", "forms", "slots", "contexts", "energyLevels"],
    );
  }

  return NextResponse.json(result, { status: 200 });
}
