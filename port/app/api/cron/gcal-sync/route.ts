/**
 * GET /api/cron/gcal-sync — Council ↔ Google Calendar sync (multi-member).
 *
 * Hourly: for each team member listed in GOOGLE_IMPERSONATE_SUBJECTS (or
 * the single GOOGLE_IMPERSONATE_SUBJECT for backward compat), pull upcoming
 * events from THEIR `primary` calendar for the next 7 days, create a
 * pending meeting record per event (deduped by gcal_event_id across all
 * members — if Garrett + Maria are both invited to whirlpool, only one
 * Council record is created), and append the Council URL to each event's
 * description.
 *
 * Idempotent — uses upsertPendingMeetingFromGcal which checks for an
 * existing row by gcal_event_id before inserting. Description-patching
 * skips events whose description already contains the Council URL.
 *
 * Auth: CRON_SECRET bearer.
 *
 * Query params (manual runs):
 *   ?onlySubject=X — restrict to a single team email (debug)
 */

import { NextRequest, NextResponse } from "next/server";
import { listEvents, patchEvent } from "@/lib/gcal";
import { upsertPendingMeetingFromGcal } from "@/lib/supabase/meetings";
import { listImpersonationSubjects } from "@/lib/shared/google-sa";

export const maxDuration = 300;

const COUNCIL_BASE_URL =
  process.env.PORT_URL?.replace(/\/$/, "") ?? "https://port.windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

function councilUrlFor(meetingId: string): string {
  return `${COUNCIL_BASE_URL}/council/${meetingId}`;
}

function descriptionAlreadyHasLink(desc: string | undefined, url: string): boolean {
  if (!desc) return false;
  return desc.includes(url);
}

function appendCouncilLink(desc: string | undefined, url: string): string {
  const banner = `\n\n— council notes —\n${url}\n`;
  if (!desc) return banner.trim();
  if (desc.includes(url)) return desc;
  return desc.trimEnd() + banner;
}

/**
 * Strip a previously-appended Council banner from a description. Used by
 * the cleanup pass on external-attendee events whose URLs leaked in past
 * gcal-sync runs. Idempotent.
 */
function removeCouncilLink(desc: string | undefined): string {
  if (!desc) return "";
  // Match the banner shape regardless of which meeting id; tolerate single
  // OR double leading newlines (description may have been trimmed).
  return desc
    .replace(
      /\n*— council notes —\n+https?:\/\/[^\s]*\/council\/[A-Za-z0-9-]+\n*/g,
      "",
    )
    .trimEnd();
}

/**
 * Returns true ONLY when every attendee is on a Winded Vertigo domain.
 * Single-attendee (organizer-only) or attendee-less events are treated as
 * internal — those are typically focus blocks or 1:1 placeholders.
 *
 * WV_DOMAINS env var allows configuring additional internal domains
 * (comma-separated). Defaults to just windedvertigo.com.
 */
function isInternalOnlyEvent(
  attendees: string[],
): { internal: boolean; externalEmails: string[] } {
  const domains = (process.env.WV_DOMAINS ?? "windedvertigo.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const externals = attendees.filter((email) => {
    const at = email.lastIndexOf("@");
    if (at < 0) return true; // malformed = treat as external to be safe
    const domain = email.slice(at + 1).toLowerCase();
    return !domains.includes(domain);
  });
  return { internal: externals.length === 0, externalEmails: externals };
}

interface PerSubjectResult {
  subject: string;
  scanned: number;
  created: number;
  existed: number;
  descriptionsPatched: number;
  descriptionsSkippedNoPermission: number;
  /**
   * Patches skipped because the event has external (non-WV) attendees who
   * would otherwise see the Council URL in their calendar. Council records
   * are still created — only the description-append is skipped.
   */
  descriptionsSkippedExternal: number;
  /** Past-leaked Council URLs cleaned from external events this run. */
  descriptionsCleanedExternal: number;
  skipped: number;
  errors: string[];
}

async function syncOneSubject(
  subject: string,
  opts: { backCleanupDays?: number } = {},
): Promise<PerSubjectResult> {
  const now = new Date();
  // Default forward window = 7 days (the normal cron behavior).
  // Optional backward window — when set, we ALSO walk past events to remove
  // any Council URLs that were appended before the external-attendee gate
  // was added. Past events don't get pre-created; this is cleanup-only.
  const timeMin = opts.backCleanupDays
    ? new Date(now.getTime() - opts.backCleanupDays * 24 * 60 * 60 * 1000).toISOString()
    : now.toISOString();
  const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const events = await listEvents(timeMin, timeMax, "primary", subject);

  const result: PerSubjectResult = {
    subject,
    scanned: 0,
    created: 0,
    existed: 0,
    descriptionsPatched: 0,
    descriptionsSkippedNoPermission: 0,
    descriptionsSkippedExternal: 0,
    descriptionsCleanedExternal: 0,
    skipped: 0,
    errors: [],
  };

  if (events === null) {
    result.errors.push("gcal auth/list failed");
    return result;
  }
  result.scanned = events.length;

  for (const event of events) {
    if (event.status === "cancelled") { result.skipped++; continue; }
    if (event.eventType && event.eventType !== "default") {
      // Working-location/focusTime/outOfOffice — skip
      result.skipped++;
      continue;
    }
    const title = (event.summary ?? "").trim();
    if (!title) { result.skipped++; continue; }

    const startedAt = event.start?.dateTime ?? event.start?.date ?? null;
    const endedAt   = event.end?.dateTime ?? event.end?.date ?? null;
    const organizerEmail = event.organizer?.email ?? null;
    const attendeeEmails = (event.attendees ?? [])
      .map((a) => a.email)
      .filter((e): e is string => typeof e === "string" && !e.endsWith(".calendar.google.com"));

    try {
      // Past events skip upsertPendingMeetingFromGcal — those should only
      // get Council records when a real Meet transcript ingest populates
      // them. Creating empty pending records for every past meeting would
      // pollute the Council view with summaryless ghosts.
      const isPastEvent = startedAt
        ? new Date(startedAt).getTime() < Date.now()
        : false;

      const { internal, externalEmails } = isInternalOnlyEvent(attendeeEmails);

      // Cleanup-mode path for past external events (no upsert).
      if (isPastEvent) {
        if (!internal) {
          const hasLeakedLink = event.description?.includes(`${COUNCIL_BASE_URL}/council/`);
          if (hasLeakedLink) {
            const cleaned = removeCouncilLink(event.description);
            const patchResult = await patchEvent(
              event.id,
              { description: cleaned },
              "primary",
              subject,
            );
            if (patchResult === "ok") result.descriptionsCleanedExternal++;
            else if (patchResult === "skipped_permission") result.descriptionsSkippedNoPermission++;
            else result.errors.push(`cleanup patchEvent failed for ${event.id}`);
          }
        }
        result.skipped++;
        continue;
      }

      // Future event — full pipeline.
      // Dedupe across team: if Maria already pre-created this gcal_event_id
      // from her sync earlier this run, our upsert returns isNew=false and
      // we update the existing row with Garrett's view of attendees.
      //
      // Honor GCal's per-event visibility flag. `private` and `confidential`
      // are both treated as private in Council — they're the user explicitly
      // saying "don't show this to other people who can see my calendar."
      // Mirroring that into Council pre-creation prevents personal events
      // (therapy, doctor, family) from ever appearing on the shared list.
      const gcalVisibility =
        event.visibility === "private" || event.visibility === "confidential"
          ? "private"
          : "shared";
      const meetingRow = await upsertPendingMeetingFromGcal({
        gcalEventId: event.id,
        title,
        startedAt,
        endedAt,
        organizerEmail,
        attendeeEmails,
        visibility: gcalVisibility,
        // Owner only meaningful for private rows; for shared we leave null
        // so anyone on the team can claim ownership later if they want.
        ownerEmail: gcalVisibility === "private" ? subject : null,
      });
      if (!meetingRow) {
        result.errors.push(`upsert returned null for ${event.id}`);
        continue;
      }

      if (meetingRow.isNew) result.created++;
      else result.existed++;

      const councilUrl = councilUrlFor(meetingRow.id);

      if (!internal) {
        // External attendees present — don't leak the Council URL into the
        // event description that they'll see in their calendar UI.
        // Council record still exists internally; team navigates via /council.
        const hasLeakedLink = event.description?.includes(`${COUNCIL_BASE_URL}/council/`);
        if (hasLeakedLink) {
          // Past gcal-sync runs may have appended a Council URL before this
          // gating was added. Strip it now to clean up the leak.
          const cleaned = removeCouncilLink(event.description);
          const patchResult = await patchEvent(
            event.id,
            { description: cleaned },
            "primary",
            subject,
          );
          if (patchResult === "ok") result.descriptionsCleanedExternal++;
          else if (patchResult === "skipped_permission") result.descriptionsSkippedNoPermission++;
          else result.errors.push(`cleanup patchEvent failed for ${event.id}`);
        } else {
          // Never appended in the first place — just record we skipped.
          result.descriptionsSkippedExternal++;
        }
        // Log once per external event for visibility into the policy at work.
        if (externalEmails.length > 0) {
          console.log(
            `[gcal-sync] external event ${event.id}: ${externalEmails.length} external attendee(s) — skipping council URL`,
          );
        }
      } else if (!descriptionAlreadyHasLink(event.description, councilUrl)) {
        // Internal-only event — safe to append the Council URL.
        const newDesc = appendCouncilLink(event.description, councilUrl);
        const patchResult = await patchEvent(event.id, { description: newDesc }, "primary", subject);
        if (patchResult === "ok") result.descriptionsPatched++;
        else if (patchResult === "skipped_permission") result.descriptionsSkippedNoPermission++;
        else result.errors.push(`patchEvent failed for ${event.id}`);
      }
    } catch (err) {
      result.errors.push(
        `event ${event.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return result;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const onlySubject = req.nextUrl.searchParams.get("onlySubject");
  const backCleanupDaysParam = req.nextUrl.searchParams.get("backCleanupDays");
  const backCleanupDays = backCleanupDaysParam
    ? Number.parseInt(backCleanupDaysParam, 10)
    : undefined;
  const allSubjects = listImpersonationSubjects();
  const subjects = onlySubject
    ? allSubjects.filter((s) => s === onlySubject.toLowerCase())
    : allSubjects;
  if (subjects.length === 0) {
    return NextResponse.json(
      {
        error: "no_subjects",
        message:
          "Set GOOGLE_IMPERSONATE_SUBJECTS (csv) or GOOGLE_IMPERSONATE_SUBJECT on the worker.",
      },
      { status: 503 },
    );
  }

  const perSubject: PerSubjectResult[] = [];
  for (const subject of subjects) {
    perSubject.push(await syncOneSubject(subject, { backCleanupDays }));
  }

  const summary = perSubject.reduce(
    (acc, p) => ({
      members: acc.members + 1,
      scanned: acc.scanned + p.scanned,
      created: acc.created + p.created,
      existed: acc.existed + p.existed,
      descriptionsPatched: acc.descriptionsPatched + p.descriptionsPatched,
      descriptionsSkippedNoPermission:
        acc.descriptionsSkippedNoPermission + p.descriptionsSkippedNoPermission,
      descriptionsSkippedExternal: acc.descriptionsSkippedExternal + p.descriptionsSkippedExternal,
      descriptionsCleanedExternal: acc.descriptionsCleanedExternal + p.descriptionsCleanedExternal,
      skipped: acc.skipped + p.skipped,
      errors: acc.errors + p.errors.length,
    }),
    {
      members: 0,
      scanned: 0,
      created: 0,
      existed: 0,
      descriptionsPatched: 0,
      descriptionsSkippedNoPermission: 0,
      descriptionsSkippedExternal: 0,
      descriptionsCleanedExternal: 0,
      skipped: 0,
      errors: 0,
    },
  );

  console.log("[gcal-sync]", JSON.stringify({ summary, perSubject }));
  return NextResponse.json({ ok: true, summary, perSubject });
}
