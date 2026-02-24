/**
 * API route: /api/runs/[id]/evidence/[evidenceId]
 *
 * PATCH  — update an evidence item (creator/admin only)
 * DELETE — delete an evidence item (creator/admin only)
 *
 * Phase A — evidence capture (practitioner tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { updateEvidence, deleteEvidence } from "@/lib/queries/evidence";
import { logAccess } from "@/lib/queries/audit";
import { MAX_LENGTHS, checkLength } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const session = await requireAuth();
  const { evidenceId } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: 400 },
    );
  }

  // Whitelist allowed keys
  const ALLOWED_KEYS = new Set([
    "quoteText", "quoteAttribution", "body", "promptKey", "sortOrder",
    "storageKey", "thumbnailKey",
  ]);
  const unknownKeys = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { error: `unknown fields: ${unknownKeys.join(", ")}` },
      { status: 400 },
    );
  }

  // Length validation
  const lengthErr =
    checkLength("quoteText", body.quoteText, MAX_LENGTHS.freeText) ||
    checkLength("quoteAttribution", body.quoteAttribution, MAX_LENGTHS.title) ||
    checkLength("body", body.body, MAX_LENGTHS.freeText) ||
    checkLength("promptKey", body.promptKey, MAX_LENGTHS.title) ||
    checkLength("storageKey", body.storageKey, MAX_LENGTHS.title) ||
    checkLength("thumbnailKey", body.thumbnailKey, MAX_LENGTHS.title);
  if (lengthErr) {
    return NextResponse.json({ error: lengthErr }, { status: 400 });
  }

  const updated = await updateEvidence(evidenceId, body, session);

  if (!updated) {
    return NextResponse.json(
      { error: "evidence not found or not authorised to edit" },
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
    "update_evidence",
    ip,
    Object.keys(body),
  );

  return NextResponse.json({ message: "evidence updated" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const session = await requireAuth();
  const { evidenceId } = await params;

  const deleted = await deleteEvidence(evidenceId, session);

  if (!deleted) {
    return NextResponse.json(
      { error: "evidence not found or not authorised to delete" },
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
    "delete_evidence",
    ip,
    ["evidence_type", deleted.evidence_type],
    deleted.storage_key ? { storage_key: deleted.storage_key } : undefined,
  );

  // Return the deleted row so the caller can clean up R2 storage if needed
  return NextResponse.json({
    message: "evidence deleted",
    storageKey: deleted.storage_key,
    thumbnailKey: deleted.thumbnail_key,
  });
}
