/**
 * GET /api/cron/meet-transcript-ingest — Council Meet AI ingest (multi-member).
 *
 * Hourly: scans the configured Drive folder for new "Notes by Gemini" /
 * transcript Docs in EACH team member's Drive, parses each one, matches to
 * the pending Council meeting row from gcal-sync, runs extractMeetingActions,
 * and merges summary + action items into Supabase.
 *
 * Env vars:
 *   CRON_SECRET                   — Bearer auth
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — SA used for Drive read (DWD authorized
 *                                   with drive.readonly scope)
 *   GOOGLE_IMPERSONATE_SUBJECTS   — comma-separated team emails to iterate
 *                                   (e.g. "garrett@,maria@,lamis@,payton@")
 *   GOOGLE_IMPERSONATE_SUBJECT    — single-user fallback (preserved for
 *                                   backward compat with the original
 *                                   single-user deploy)
 *   MEET_TRANSCRIPTS_FOLDER_ID    — optional: explicit Drive folder id.
 *                                   When unset, "Meet Recordings" is looked
 *                                   up by name per-member (each member has
 *                                   their own folder of the same name).
 *
 * Query params (manual runs):
 *   ?sinceDays=N   — backfill window in days (default: 25h)
 *   ?maxDocs=N     — per-member doc cap
 *   ?onlySubject=X — restrict to a single team email (debug)
 */

import { NextRequest, NextResponse } from "next/server";
import { ingestRecentMeetTranscripts } from "@/lib/meeting-ingest/sources/google-meet-drive";
import { findFolderByName } from "@/lib/gdrive";
import { listImpersonationSubjects } from "@/lib/shared/google-sa";

export const maxDuration = 300;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

interface PerSubjectResult {
  subject: string;
  folderId: string | null;
  scanned: number;
  ingested: number;
  skippedAlreadySeen: number;
  skippedNoMatch: number;
  errors: string[];
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sinceDaysParam = req.nextUrl.searchParams.get("sinceDays");
  const sinceDays = sinceDaysParam ? Number.parseInt(sinceDaysParam, 10) : null;
  const sinceIso = sinceDays
    ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  const maxDocsParam = req.nextUrl.searchParams.get("maxDocs");
  const maxDocs = maxDocsParam ? Number.parseInt(maxDocsParam, 10) : undefined;
  const onlySubject = req.nextUrl.searchParams.get("onlySubject");

  const allSubjects = listImpersonationSubjects();
  const subjects = onlySubject
    ? allSubjects.filter((s) => s === onlySubject.toLowerCase())
    : allSubjects;
  if (subjects.length === 0) {
    return NextResponse.json(
      {
        error: "no_subjects",
        message:
          "Set GOOGLE_IMPERSONATE_SUBJECTS (csv) or GOOGLE_IMPERSONATE_SUBJECT on the worker so we know whose Drive to read.",
      },
      { status: 503 },
    );
  }

  // Static folder id from env wins. Per-member folder lookup happens inside
  // the loop when env isn't set — each member has their own "Meet Recordings".
  const staticFolderId = process.env.MEET_TRANSCRIPTS_FOLDER_ID || undefined;

  const perSubject: PerSubjectResult[] = [];

  for (const subject of subjects) {
    // Resolve folder for this member. With DWD impersonation, "Meet Recordings"
    // exists separately in each user's Drive — and gdrive.findFolderByName
    // honors the subject param to look in the right user's Drive.
    let folderId = staticFolderId;
    if (!folderId) {
      folderId =
        (await findFolderByName("Meet Recordings", { subject })) ?? undefined;
    }
    if (!folderId) {
      perSubject.push({
        subject,
        folderId: null,
        scanned: 0,
        ingested: 0,
        skippedAlreadySeen: 0,
        skippedNoMatch: 0,
        errors: ["no_folder — set MEET_TRANSCRIPTS_FOLDER_ID or share a 'Meet Recordings' folder with the impersonated user"],
      });
      continue;
    }

    const result = await ingestRecentMeetTranscripts({
      folderId,
      sinceIso,
      maxDocs,
      subject,
    });
    perSubject.push({ subject, folderId, ...result });
  }

  // Roll-up for the cron-router consumer + audit DB.
  const summary = perSubject.reduce(
    (acc, p) => ({
      members: acc.members + 1,
      scanned: acc.scanned + p.scanned,
      ingested: acc.ingested + p.ingested,
      skippedAlreadySeen: acc.skippedAlreadySeen + p.skippedAlreadySeen,
      skippedNoMatch: acc.skippedNoMatch + p.skippedNoMatch,
      errors: acc.errors + p.errors.length,
    }),
    { members: 0, scanned: 0, ingested: 0, skippedAlreadySeen: 0, skippedNoMatch: 0, errors: 0 },
  );

  console.log("[meet-transcript-ingest]", JSON.stringify({ summary, perSubject }));
  return NextResponse.json({ ok: true, summary, perSubject });
}
