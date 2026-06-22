/**
 * GET /api/review — list pending review-queue items for the /inbox page.
 * Session-authenticated (the page is behind the dashboard auth).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listReviewItems } from "@/lib/review-queue";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await listReviewItems("pending");
  return NextResponse.json({ items });
}
