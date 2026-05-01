import { NextResponse } from "next/server";
import { fetchActivityBySlug } from "@/lib/notion";

/**
 * Slim activity-metadata endpoint used by the capture page to snapshot
 * an activity's title + skill slugs onto each saved Capture, so the
 * gallery's reflection prompt can pass real skills (not a hardcoded
 * list) to mirror.log.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const activity = await fetchActivityBySlug(slug);
  if (!activity) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(
    { slug: activity.slug, title: activity.title, skillSlugs: activity.skillSlugs },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } },
  );
}
