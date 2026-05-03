/**
 * GET /api/rfp-radar/[id]/proposal-status
 *
 * Lightweight polling endpoint for the proposal generation progress tracker.
 * Reads directly from Supabase (not Notion) for low latency — the detail page
 * Server Component does the slow Notion read; this route only needs the fast
 * atomic columns that Inngest writes during generation.
 *
 * Auth required. Returns 200 with progress data on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProposalProgress } from "@/lib/supabase/rfp-opportunities";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let progress;
  try {
    progress = await getProposalProgress(id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[proposal-status] supabase read failed rfpId=${id}:`, msg);
    return NextResponse.json({ error: "failed to read progress" }, { status: 500 });
  }

  if (!progress) {
    // Row not in Supabase yet (Notion-only record) — return null status
    return NextResponse.json({ status: null, step: null, startedAt: null, completedAt: null });
  }

  return NextResponse.json(progress);
}
