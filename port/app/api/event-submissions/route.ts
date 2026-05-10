/**
 * GET  /api/event-submissions?eventId=<id> — list submissions for an event
 * POST /api/event-submissions               — create a new submission
 *
 * Phase 6: multi-submission tracking per conference. Auth-gated to signed-in
 * @windedvertigo.com users (mirrors /api/events/[id]).
 */

import { NextRequest } from "next/server";
import {
  listSubmissionsByEvent,
  createSubmission,
  type SubmissionKind,
  type SubmissionStatus,
} from "@/lib/supabase/event-submissions";
import { json, error, param } from "@/lib/api-helpers";
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

export async function GET(req: NextRequest) {
  const eventId = param(req, "eventId");
  if (!eventId) return error("eventId query param is required");

  try {
    const submissions = await listSubmissionsByEvent(eventId);
    return json({ submissions });
  } catch (err) {
    console.error("[event-submissions] GET failed:", err);
    return error("failed to load submissions", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return error("invalid json body");

  if (!body.eventId || typeof body.eventId !== "string") {
    return error("eventId is required");
  }
  if (!body.kind || !VALID_KINDS.includes(body.kind)) {
    return error(`kind must be one of: ${VALID_KINDS.join(", ")}`);
  }
  if (!body.title || typeof body.title !== "string") {
    return error("title is required");
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  try {
    const status: SubmissionStatus = body.status ?? "drafting";
    const submission = await createSubmission({
      eventId: body.eventId,
      kind: body.kind,
      title: body.title,
      abstract: body.abstract ?? "",
      status,
      decisionAt: null,
      presenterContactIds: body.presenterContactIds ?? [],
      submittedBy: session.user.email,
      submittedAt: status === "submitted" ? new Date().toISOString() : null,
      notes: body.notes ?? "",
    });
    return json(submission, 201);
  } catch (err) {
    console.error("[event-submissions] POST failed:", err);
    return error("failed to create submission", 500);
  }
}
