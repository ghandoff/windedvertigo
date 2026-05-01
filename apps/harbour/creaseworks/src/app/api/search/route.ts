/**
 * GET /api/search?q=...
 *
 * Server-side search across playdates and collections.
 * Requires authentication. Returns teaser-safe fields only.
 *
 * Query params:
 *   q — search query (min 2 chars, max 100 chars)
 *
 * Phase 2 — P2-2: server-side playdate search.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { search } from "@/lib/queries/search";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json(
      { playdates: [], collections: [], query: q },
    );
  }

  if (q.length > 100) {
    return NextResponse.json(
      { error: "query too long (max 100 chars)" },
      { status: 400 },
    );
  }

  try {
    const results = await search(q);
    return NextResponse.json(results);
  } catch (err: any) {
    console.error("[search] query failed:", err);
    return NextResponse.json(
      { error: "search failed" },
      { status: 500 },
    );
  }
}
