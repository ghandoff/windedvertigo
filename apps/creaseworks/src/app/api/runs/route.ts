/**
 * API route: /api/runs
 *
 * GET  — list runs (visibility-aware)
 * POST — create a new run
 *
 * MVP 5 — runs and evidence.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getRunsForUser, createRun, batchGetRunMaterials } from "@/lib/queries/runs";
import { logAccess } from "@/lib/queries/audit";
import { MAX_LENGTHS, checkLength, sanitiseStringArray } from "@/lib/validation";
import { parseJsonBody } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const session = await requireAuth();

  // Pagination params (audit M3)
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const runs = await getRunsForUser(session, limit, offset);

  // Single-query batch fetch — audit fix #9: replaces N+1
  const materialsMap = await batchGetRunMaterials(runs.map((r) => r.id));
  const runsWithMaterials = runs.map((run) => ({
    ...run,
    materials: materialsMap.get(run.id) ?? [],
  }));

  // Strip reflective fields for external users viewing other people's runs
  const sanitised = runsWithMaterials.map((run) => {
    if (session.isInternal || run.created_by === session.userId) return run;
    return { ...run, what_changed: null, next_iteration: null };
  });

  return NextResponse.json({ runs: sanitised, pagination: { limit, offset } });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime-validated below
  const body = parsed as Record<string, any>;

  const { title, playdateId, runType, runDate, contextTags, traceEvidence, whatChanged, nextIteration, materialIds, isFindAgain } = body;

  // Validate required fields
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 },
    );
  }
  if (!runType || typeof runType !== "string") {
    return NextResponse.json(
      { error: "run type is required" },
      { status: 400 },
    );
  }
  if (!runDate || typeof runDate !== "string") {
    return NextResponse.json(
      { error: "run date is required" },
      { status: 400 },
    );
  }

  // Length validation — audit fix: prevent megabyte-sized payloads reaching Postgres
  const lengthErr =
    checkLength("title", title, MAX_LENGTHS.title) ||
    checkLength("runType", runType, MAX_LENGTHS.title) ||
    checkLength("runDate", runDate, MAX_LENGTHS.title) ||
    checkLength("whatChanged", whatChanged, MAX_LENGTHS.freeText) ||
    checkLength("nextIteration", nextIteration, MAX_LENGTHS.freeText);
  if (lengthErr) {
    return NextResponse.json({ error: lengthErr }, { status: 400 });
  }

  try {
    const runId = await createRun(
      {
        title: title.trim(),
        playdateId: playdateId || null,
        runType,
        runDate,
        contextTags: sanitiseStringArray(contextTags),
        traceEvidence: sanitiseStringArray(traceEvidence),
        whatChanged: whatChanged || null,
        nextIteration: nextIteration || null,
        materialIds: sanitiseStringArray(materialIds, MAX_LENGTHS.arrayMax, MAX_LENGTHS.uuid),
        isFindAgain: isFindAgain === true,
      },
      session,
    );

    // Audit log (M1: capture IP)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      null,
      null,
      "create_run",
      ip,
      ["title", "run_type", "run_date"],
    );

    return NextResponse.json({ id: runId, message: "run created" }, { status: 201 });
  } catch (err: any) {
    console.error("create run error:", err);
    return NextResponse.json(
      { error: "failed to create run" },
      { status: 500 },
    );
  }
}
