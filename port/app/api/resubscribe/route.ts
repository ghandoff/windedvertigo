/**
 * POST /api/resubscribe?t=TOKEN
 *
 * Public (no auth) — called from the unsubscribe page "undo" button.
 * Decodes the same token used for unsubscribe, sets the org back to
 * "Contacted" so they re-enter the active outreach pool.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getOrganization, updateOutreachStatus } from "@/lib/notion/organizations";
import { decodeUnsubscribeToken } from "@/lib/email/unsubscribe";

export async function POST(req: NextRequest) {
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

    await updateOutreachStatus(orgId, "Contacted");
    return NextResponse.json({ success: true, orgName: org.organization });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
}
