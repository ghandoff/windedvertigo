/**
 * Image proxy route — serves R2 images via presigned redirect.
 *
 * When R2_PUBLIC_URL is not configured, getPublicUrl() returns
 * "/api/images/{key}" instead of a direct URL. This route generates
 * a short-lived presigned GET URL and 302-redirects to it.
 *
 * Once R2_PUBLIC_URL is set (recommended for production), this route
 * is no longer hit — getPublicUrl() returns the direct URL instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateReadUrl } from "@/lib/r2";

/** Cache presigned redirects for 30 minutes in the browser. */
const CACHE_SECONDS = 1800;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const storageKey = key.join("/");

  if (!storageKey) {
    return NextResponse.json({ error: "missing key" }, { status: 400 });
  }

  try {
    // Generate a 1-hour presigned URL
    const url = await generateReadUrl(storageKey, 3600);

    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=60`,
      },
    });
  } catch (err) {
    console.error("[api/images] failed to generate presigned URL:", err);
    return NextResponse.json(
      { error: "image not available" },
      { status: 500 },
    );
  }
}
