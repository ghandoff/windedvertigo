/**
 * API route: /api/evidence/portfolio
 *
 * GET — fetch portfolio evidence for the current user.
 * Returns evidence items enriched with reflection + playdate context.
 * Photo items include presigned read URLs (1-hour expiry).
 *
 * Query params:
 *   type     — filter by evidence type (photo, quote, observation, artifact)
 *   playdate — filter by playdate slug
 *   limit    — pagination limit (default 50, max 200)
 *   offset   — pagination offset (default 0)
 *
 * Phase C — evidence portfolio (practitioner tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getPortfolioEvidence,
  countPortfolioEvidence,
  type EvidenceType,
} from "@/lib/queries/evidence";
import { generateReadUrl } from "@/lib/r2";

const VALID_TYPES = new Set<EvidenceType>(["photo", "quote", "observation", "artifact"]);

export async function GET(req: NextRequest) {
  const session = await requireAuth();

  const url = req.nextUrl;
  const typeParam = url.searchParams.get("type") as EvidenceType | null;
  const playdateSlug = url.searchParams.get("playdate");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    200,
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

  // Validate type filter
  if (typeParam && !VALID_TYPES.has(typeParam)) {
    return NextResponse.json(
      { error: `type must be one of: ${[...VALID_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  const opts = {
    evidenceType: typeParam ?? undefined,
    playdateSlug: playdateSlug ?? undefined,
    limit,
    offset,
  };

  const [items, total] = await Promise.all([
    getPortfolioEvidence(session.userId, opts),
    countPortfolioEvidence(session.userId, opts),
  ]);

  // Sign photo URLs
  const enriched = await Promise.all(
    items.map(async (item) => {
      if (item.evidence_type === "photo" && item.storage_key) {
        try {
          const photoUrl = await generateReadUrl(item.storage_key);
          const thumbUrl = item.thumbnail_key
            ? await generateReadUrl(item.thumbnail_key)
            : photoUrl;
          return { ...item, photoUrl, thumbUrl };
        } catch {
          // R2 not configured or key missing — return without URL
          return { ...item, photoUrl: null, thumbUrl: null };
        }
      }
      return item;
    }),
  );

  return NextResponse.json({
    items: enriched,
    pagination: { total, limit, offset },
  });
}
