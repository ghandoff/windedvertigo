/**
 * API route: /api/evidence/share
 *
 * POST — create a shareable link for the user's evidence portfolio.
 * Returns the public URL path and expiry date.
 *
 * Body (JSON):
 *   type     — optional evidence type filter
 *   playdate — optional playdate slug filter
 *
 * Phase D — evidence export (practitioner tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { createShare, type ShareFilters } from "@/lib/queries/evidence-shares";
import type { EvidenceType } from "@/lib/queries/evidence";

const VALID_TYPES = new Set<EvidenceType>(["photo", "quote", "observation", "artifact"]);

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — no filters
  }

  const typeParam = body.type as EvidenceType | undefined;
  const playdateParam = body.playdate as string | undefined;

  if (typeParam && !VALID_TYPES.has(typeParam)) {
    return NextResponse.json(
      { error: `type must be one of: ${[...VALID_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  const filters: ShareFilters = {};
  if (typeParam) filters.type = typeParam;
  if (playdateParam) filters.playdate = playdateParam;

  const share = await createShare(session.userId, filters);

  return NextResponse.json({
    url: `/evidence/shared/${share.token}`,
    expiresAt: share.expires_at,
  });
}
