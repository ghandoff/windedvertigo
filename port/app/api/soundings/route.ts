/**
 * /api/soundings — session-authed sounding-board management.
 *
 * POST — manually open a sounding for an arbitrary doc (maria/garrett kicking
 *        one off by hand): posts a fresh root message to the channel, opens
 *        the feedback thread, attaches reviewers + 👤 questions.
 * GET  — recent soundings (whirlpool screen-share / debugging view).
 *
 * Session auth (Auth.js) — these routes are not on any allowlist, so the
 * middleware already requires a logged-in team member; the explicit check
 * here also gives us the email for created_by / provenance.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";
import { createManualSounding } from "@/lib/soundings/create";
import { listSoundings } from "@/lib/supabase/soundings";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return error("invalid json", 400);

  const { docTitle, docUrl, channel, reviewerEmails, questions, deadlineAt } = body as {
    docTitle?: string;
    docUrl?: string;
    channel?: string;
    reviewerEmails?: string[];
    questions?: Array<{ text?: string; askedByName?: string }>;
    deadlineAt?: string;
  };

  if (!docTitle?.trim()) return error("docTitle is required", 400);
  if (deadlineAt && Number.isNaN(Date.parse(deadlineAt))) {
    return error("deadlineAt must be an ISO timestamp", 400);
  }
  const cleanQuestions = (questions ?? [])
    .filter((q) => typeof q?.text === "string" && q.text.trim().length > 0)
    .map((q) => ({ text: q.text!.trim(), askedByName: q.askedByName?.trim() }));

  const sounding = await createManualSounding({
    docTitle: docTitle.trim(),
    docUrl: docUrl?.trim() || undefined,
    channel: channel?.trim() || undefined,
    reviewerEmails,
    questions: cleanQuestions,
    deadlineAt,
    createdBy: session.user.email,
  });

  if (!sounding) return error("could not create sounding — check slack channel access", 502);
  return json({ sounding }, 201);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const soundings = await listSoundings();
  return json({ soundings });
}
