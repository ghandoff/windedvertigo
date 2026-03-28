/**
 * GET /api/unsubscribe?t=TOKEN
 *
 * Public (no auth) — called by the unsubscribe page or by email clients
 * that support one-click List-Unsubscribe-Post.
 *
 * Decodes the base64url org ID token, marks the org as "Opted out" in
 * Notion, and returns a JSON result. The UI page handles the display.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getOrganization, updateOutreachStatus } from "@/lib/notion/organizations";
import { decodeUnsubscribeToken } from "@/lib/email/unsubscribe";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const orgId = decodeUnsubscribeToken(token);
    const org = await getOrganization(orgId);
    if (!org) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await updateOutreachStatus(orgId, "Opted out");
    return NextResponse.json({ success: true, orgName: org.organization });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
}

// Support one-click unsubscribe (RFC 8058) via POST
export async function POST(req: NextRequest) {
  return GET(req);
}
