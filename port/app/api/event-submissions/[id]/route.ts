/**
 * PATCH  /api/event-submissions/[id] — update a submission
 * DELETE /api/event-submissions/[id] — delete a submission
 *
 * Phase 6: status transitions to accepted/rejected auto-stamp decision_at;
 * transitions to submitted auto-stamp submitted_at if not already set.
 */

import { NextRequest } from "next/server";
import {
  getSubmissionById,
  updateSubmission,
  deleteSubmission,
  type SubmissionKind,
  type SubmissionStatus,
} from "@/lib/supabase/event-submissions";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

const VALID_KINDS: SubmissionKind[] = [
  "talk",
  "panel",
  "workshop",
  "sponsorship",
  "booth",
  "poster",
  "other",
];
const VALID_STATUSES: SubmissionStatus[] = [
  "drafting",
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return error("invalid json body");

  if (body.kind !== undefined && !VALID_KINDS.includes(body.kind)) {
    return error(`kind must be one of: ${VALID_KINDS.join(", ")}`);
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  try {
    const existing = await getSubmissionById(id);
    if (!existing) return error("submission not found", 404);

    const patch: Parameters<typeof updateSubmission>[1] = {};
    if (body.kind !== undefined) patch.kind = body.kind;
    if (body.title !== undefined) patch.title = body.title;
    if (body.abstract !== undefined) patch.abstract = body.abstract;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.presenterContactIds !== undefined) {
      patch.presenterContactIds = body.presenterContactIds;
    }

    if (body.status !== undefined) {
      const newStatus = body.status as SubmissionStatus;
      patch.status = newStatus;

      // Auto-stamp decision_at when transitioning to a terminal decision.
      if (
        (newStatus === "accepted" || newStatus === "rejected") &&
        existing.status !== newStatus &&
        body.decisionAt === undefined
      ) {
        patch.decisionAt = new Date().toISOString();
      }
      // Auto-stamp submitted_at when first transitioning to submitted.
      if (
        newStatus === "submitted" &&
        !existing.submittedAt &&
        body.submittedAt === undefined
      ) {
        patch.submittedAt = new Date().toISOString();
      }
    }
    if (body.decisionAt !== undefined) patch.decisionAt = body.decisionAt;
    if (body.submittedAt !== undefined) patch.submittedAt = body.submittedAt;

    const updated = await updateSubmission(id, patch);
    return json(updated);
  } catch (err) {
    console.error("[event-submissions] PATCH failed:", err);
    return error("failed to update submission", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const { id } = await params;
  try {
    await deleteSubmission(id);
    return json({ deleted: true });
  } catch (err) {
    console.error("[event-submissions] DELETE failed:", err);
    return error("failed to delete submission", 500);
  }
}
