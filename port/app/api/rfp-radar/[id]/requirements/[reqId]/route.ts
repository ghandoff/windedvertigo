/**
 * Requirement-row mutations.
 *
 *   POST   → approve this row (set approved_by + approved_at to current user/now)
 *   PATCH  → edit fields (label, page_limit, required_sections, …). Optionally
 *            resets approval if the change is significant.
 *   DELETE → remove the row (e.g. "this isn't actually a requirement")
 *
 * All operations require an authenticated session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  approveRequirement,
  updateRequirement,
  deleteRequirement,
  type RequirementKind,
} from "@/lib/supabase/rfp-requirements";

interface RouteContext {
  params: Promise<{ id: string; reqId: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { reqId } = await ctx.params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await approveRequirement(reqId, session.user.email);
    console.warn(`[requirements] ${reqId} approved by ${session.user.email}`);
    return NextResponse.json({ ok: true, approvedBy: session.user.email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "approve failed", detail: msg }, { status: 500 });
  }
}

interface PatchBody {
  kind?: RequirementKind;
  label?: string;
  description?: string | null;
  pageLimit?: number | null;
  wordLimit?: number | null;
  format?: "pdf" | "docx" | "either" | null;
  requiredSections?: string[];
  weightPct?: number | null;
  required?: boolean;
  /** True when the edit is significant enough that prior approval should be cleared. */
  resetApproval?: boolean;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { reqId } = await ctx.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const updated = await updateRequirement(reqId, body);
    return NextResponse.json({ ok: true, requirement: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "update failed", detail: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { reqId } = await ctx.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await deleteRequirement(reqId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "delete failed", detail: msg }, { status: 500 });
  }
}
