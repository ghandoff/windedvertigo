/**
 * GET /api/designs/[slug]/pdf — render a designed doc to PDF.
 *
 * Auth: requires a logged-in port session (middleware enforces this since
 * the path doesn't start with /api/auth or any of the allowlisted public
 * prefixes).
 *
 * Returns the PDF inline (Content-Disposition: inline) so browsers preview
 * it; add ?download=1 to force a download.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDesignDoc } from "@/lib/supabase/design-docs";
import { renderDesignDoc } from "@/lib/design-renderer";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const doc = await getDesignDoc(slug);
  if (!doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const buffer = await renderDesignDoc({
      template:        doc.template,
      title:           doc.title,
      contentMarkdown: doc.contentMarkdown,
      frontmatter:     doc.frontmatter,
    });

    const download = req.nextUrl.searchParams.get("download") === "1";
    const filename = `${doc.slug}.pdf`;
    const disposition = download
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`[designs/pdf] render failed for slug=${slug}:`, err);
    return NextResponse.json(
      { error: "render_failed", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
