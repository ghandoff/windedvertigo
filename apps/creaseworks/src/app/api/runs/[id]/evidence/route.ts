/**
 * API route: /api/runs/[id]/evidence
 *
 * GET  — list evidence for a run
 * POST — create a new evidence item (creator/admin only)
 *
 * Phase A — evidence capture (practitioner tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getRunById } from "@/lib/queries/runs";
import { getEvidenceForRun, createEvidence } from "@/lib/queries/evidence";
import type { EvidenceType } from "@/lib/queries/evidence";
import { logAccess } from "@/lib/queries/audit";
import { MAX_LENGTHS, checkLength } from "@/lib/validation";

const VALID_TYPES = new Set<EvidenceType>(["photo", "quote", "observation", "artifact"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  const { id: runId } = await params;

  // Visibility check: can the user see this run?
  const run = await getRunById(runId, session);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const evidence = await getEvidenceForRun(runId);
  return NextResponse.json({ evidence });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  const { id: runId } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: 400 },
    );
  }

  const { evidenceType, storageKey, thumbnailKey, quoteText, quoteAttribution, body: evidenceBody, promptKey, sortOrder } = body;

  // Validate evidence type
  if (!evidenceType || !VALID_TYPES.has(evidenceType)) {
    return NextResponse.json(
      { error: `evidence_type must be one of: ${[...VALID_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  // Type-specific validation
  if (evidenceType === "quote") {
    if (!quoteText || typeof quoteText !== "string" || !quoteText.trim()) {
      return NextResponse.json(
        { error: "quote_text is required for quote evidence" },
        { status: 400 },
      );
    }
  }

  if (evidenceType === "observation" || evidenceType === "artifact") {
    if (!evidenceBody || typeof evidenceBody !== "string" || !evidenceBody.trim()) {
      return NextResponse.json(
        { error: "body is required for observation/artifact evidence" },
        { status: 400 },
      );
    }
  }

  // Length validation
  const lengthErr =
    checkLength("quoteText", quoteText, MAX_LENGTHS.freeText) ||
    checkLength("quoteAttribution", quoteAttribution, MAX_LENGTHS.title) ||
    checkLength("body", evidenceBody, MAX_LENGTHS.freeText) ||
    checkLength("promptKey", promptKey, MAX_LENGTHS.title) ||
    checkLength("storageKey", storageKey, MAX_LENGTHS.title) ||
    checkLength("thumbnailKey", thumbnailKey, MAX_LENGTHS.title);
  if (lengthErr) {
    return NextResponse.json({ error: lengthErr }, { status: 400 });
  }

  try {
    const evidenceId = await createEvidence(
      runId,
      {
        evidenceType,
        storageKey: storageKey || null,
        thumbnailKey: thumbnailKey || null,
        quoteText: quoteText?.trim() || null,
        quoteAttribution: quoteAttribution?.trim() || null,
        body: evidenceBody?.trim() || null,
        promptKey: promptKey || null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
      session,
    );

    if (!evidenceId) {
      return NextResponse.json(
        { error: "run not found or not authorised to add evidence" },
        { status: 404 },
      );
    }

    // Audit log
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      null,
      null,
      "create_evidence",
      ip,
      ["evidence_type", evidenceType],
    );

    return NextResponse.json(
      { id: evidenceId, message: "evidence created" },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("create evidence error:", err);
    return NextResponse.json(
      { error: "failed to create evidence" },
      { status: 500 },
    );
  }
}
