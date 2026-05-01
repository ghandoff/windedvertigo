/**
 * POST /api/audience/preview
 *
 * Live preview of audience from raw filter JSON.
 * Used by the audience builder component.
 */

import { NextRequest } from "next/server";
import { previewAudience } from "@/lib/notion/audience";
import { json, error, withNotionError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return error("filter rules are required");

  // Extract _limit (not part of AudienceFilter) before passing to previewAudience
  const { _limit, ...filters } = body;
  const limit = typeof _limit === "number" && _limit > 0 ? Math.min(_limit, 1000) : 500;

  return withNotionError(async () => {
    return await previewAudience(filters, limit);
  });
}
