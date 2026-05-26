/**
 * POST /api/designs — upsert a design doc (used by the editor save button).
 *
 * Body: { slug, title, template?, frontmatter?, contentMarkdown }
 *
 * Returns the upserted record.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { upsertDesignDoc } from "@/lib/supabase/design-docs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug             = typeof body.slug === "string" ? body.slug : "";
  const title            = typeof body.title === "string" ? body.title : "";
  const template         = typeof body.template === "string" ? body.template : "proposal-v1";
  const contentMarkdown  = typeof body.contentMarkdown === "string" ? body.contentMarkdown : "";
  const frontmatter      = (body.frontmatter && typeof body.frontmatter === "object")
    ? (body.frontmatter as Record<string, unknown>)
    : {};

  if (!slug || !title) {
    return NextResponse.json({ error: "missing slug or title" }, { status: 400 });
  }

  const doc = await upsertDesignDoc({
    slug,
    title,
    template,
    frontmatter,
    contentMarkdown,
    ownerEmail: session.user.email,
  });

  if (!doc) {
    return NextResponse.json({ error: "upsert_failed" }, { status: 500 });
  }

  return NextResponse.json({ doc });
}
