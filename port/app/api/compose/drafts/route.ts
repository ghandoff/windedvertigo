/**
 * /api/compose/drafts — list (GET) + create (POST) compose drafts.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createComposeDraft,
  listComposeDrafts,
  type ComposeChannel,
} from "@/lib/supabase/compose-drafts";

const VALID_CHANNELS: ComposeChannel[] = [
  "linkedin",
  "bluesky",
  "substack",
  "meta-facebook",
  "meta-instagram",
  "email",
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const drafts = await listComposeDrafts({ limit: 100 });
  return NextResponse.json({ drafts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const channel = typeof body.channel === "string" ? body.channel : "";
  if (!VALID_CHANNELS.includes(channel as ComposeChannel)) {
    return NextResponse.json(
      { error: "invalid_channel", expected: VALID_CHANNELS },
      { status: 400 },
    );
  }
  const draft = await createComposeDraft({
    authorEmail: session.user.email,
    channel: channel as ComposeChannel,
    title: typeof body.title === "string" ? body.title : null,
    contentText: typeof body.contentText === "string" ? body.contentText : "",
  });
  if (!draft) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json({ draft }, { status: 201 });
}
