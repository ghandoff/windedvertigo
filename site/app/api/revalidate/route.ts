/**
 * On-demand ISR revalidation endpoint.
 *
 * POST /api/revalidate
 * Body: { "paths": ["/", "/what", "/we", "/do"] }
 * Header: Authorization: Bearer <REVALIDATION_SECRET>
 *
 * Call this from a Notion webhook or manually to bust the ISR cache
 * without waiting for the 1-hour revalidation window.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATION_SECRET;

  // Auth check — require a secret to prevent abuse
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let body: { paths?: string[] };
  try {
    body = await req.json();
  } catch {
    // Default: revalidate all site pages
    body = { paths: ["/", "/what", "/we", "/do", "/quadrants", "/quadrants/explore", "/do/conference-experience"] };
  }

  const paths = body.paths ?? ["/"];
  const revalidated: string[] = [];

  for (const p of paths) {
    try {
      revalidatePath(p);
      revalidated.push(p);
    } catch (err) {
      console.error(`[revalidate] failed for ${p}:`, err);
    }
  }

  return NextResponse.json({
    revalidated,
    now: Date.now(),
  });
}
