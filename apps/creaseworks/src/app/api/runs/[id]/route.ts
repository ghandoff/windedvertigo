/**
 * API route: /api/runs/[id]
 *
 * GET   â get a single run (visibility-aware)
 * PATCH â update a run (creator only)
 *
 * MVP 5 â runs and evidence.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getRunById, getRunMaterials, updateRun } from "@/lib/queries/runs";
import { logAccess } from "@/lib/queries/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  const { id } = await params;

  const run = await getRunById(id, session);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const materials = await getRunMaterials(id);
  const fullRun = { ...run, materials };

  // Strip reflective fields for external users viewing other people's runs
  if (!session.isInternal && run.created_by !== session.userId) {
    fullRun.what_changed = null;
    fullRun.next_iteration = null;
  }

  return NextResponse.json({ run: fullRun });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: 400 },
    );
  }

  const updated = await updateRun(id, body, session);

  if (!updated) {
    return NextResponse.json(
      { error: "run not found or not authorised to edit" },
      { status: 404 },
    );
  }

  // Audit log (M1: capture IP)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    null,
    null,
    "update_run",
    ip,
    Object.keys(body),
  );

  return NextResponse.json({ message: "run updated" });
}
