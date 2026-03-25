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

  return withNotionError(async () => {
    const result = await previewAudience(body, 10);
    return json(result);
  });
}
