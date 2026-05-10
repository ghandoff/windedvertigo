/**
 * GET /api/cron/refresh-annual-conferences
 *
 * Weekly scout for the next editions of recurring conferences.
 *
 * Problem: Annual and Biannual conferences repeat every year, but the existing
 * row only captures one edition. Once the event passes, the tile has status
 * 'attend' or 'pursue' pointing to a date that's now in the past. The team
 * loses track of when the next edition opens for submissions.
 *
 * Solution: every Saturday at 09:00 UTC, find all past Annual/Biannual events
 * that don't yet have a future edition in the database, then locate and ingest
 * the next year's edition as a `candidate`.
 *
 * Discovery strategy (cheapest-first cascade):
 *   1. URL year-bump — replace the previous year with the upcoming year in the
 *      event's URL. Most conference sites (iste.org/ISTELive-2025,
 *      asugsvsummit.com/2025, etc.) use year-in-path patterns. Try the bumped
 *      URL; if it returns 200 and the content looks conference-like, use it.
 *   2. Claude knowledge prompt — for conference websites that don't embed a
 *      year in the URL, ask Claude (Haiku) whether it knows the next edition's
 *      URL. Claude has strong recall for major annual education/learning
 *      conferences.
 *   3. Skip — if both strategies fail, mark the conference as needing manual
 *      refresh and log it. The team can use the "+ ingest URL" dialog once
 *      the new edition is announced.
 *
 * Each located URL is run through the standard pipeline:
 *   dedup → triageConference → upsert as candidate
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 *
 * Schedule: Saturdays 09:00 UTC (see lib/scheduled.ts CRON_TABLE)
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getEventsFromSupabase } from "@/lib/supabase/events";
import { upsertEventToSupabase } from "@/lib/supabase/events";
import { triageConference } from "@/lib/ai/conference-triage";
import { findDuplicateConference } from "@/lib/conferences/dedup";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { postToSlack } from "@/lib/slack";
import type { CrmEvent } from "@/lib/notion/types";

export const maxDuration = 300;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

// Events per run — keeps the cron under 300s with ~5s per event (fetch + AI).
const EVENTS_PER_RUN = 15;

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

// ── helpers ────────────────────────────────────────────────────────

/** True when the event's last known date is in the past. */
function isPastEvent(evt: CrmEvent): boolean {
  const endDate   = evt.eventDates?.end ?? evt.eventDates?.start;
  const deadline  = evt.proposalDeadline?.start;
  // Use the later of event end and proposal deadline; if neither, skip.
  const latest = [endDate, deadline].filter(Boolean).sort().at(-1);
  if (!latest) return false;
  return new Date(latest) < new Date();
}

/**
 * Bump a year in the URL path from `currentYear` to `targetYear`.
 * Returns null if neither year appears in the URL.
 *
 * Handles patterns like:
 *   https://www.asugsvsummit.com/2025/  → 2026
 *   https://iste.org/ISTELive-2025       → 2026
 *   https://atdconference.td.org/         → no year in URL, null
 */
function bumpUrlYear(url: string, currentYear: number, targetYear: number): string | null {
  const cy = String(currentYear);
  const ty = String(targetYear);
  if (!url.includes(cy)) return null;
  // Only replace the year in the PATH portion, not the domain.
  try {
    const u = new URL(url);
    const newPath = u.pathname.replaceAll(cy, ty);
    const newSearch = u.search.replaceAll(cy, ty);
    if (newPath === u.pathname && newSearch === u.search) return null;
    return `${u.origin}${newPath}${newSearch}${u.hash}`;
  } catch {
    // Fallback for relative or malformed URLs
    return url.replaceAll(cy, ty);
  }
}

/** Try to fetch a URL and return the HTML, or null on failure. */
async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Sanity check: must look like an actual web page.
    if (text.length < 500) return null;
    return text;
  } catch {
    return null;
  }
}

/** Ask Claude whether it knows the next edition's URL for this conference. */
async function askClaudeForNextEdition(
  evt: CrmEvent,
  targetYear: number,
): Promise<string | null> {
  const systemPrompt = `You are a research assistant for an education design consultancy.
Return ONLY a JSON object with one key "url" containing the official homepage for the
${targetYear} edition of the given conference. If you are unsure or the conference
website does not appear to be announced yet, return {"url": null}.
Do not explain. Do not add commentary.`;

  const userMessage = `Conference name: ${evt.event}
Known past URL: ${evt.url || "(unknown)"}
Type: ${evt.type ?? "Conference"}
Location: ${evt.location ?? "unknown"}
Find the ${targetYear} edition URL.`;

  try {
    const result = await callClaude({
      feature: "conference-triage",
      system: systemPrompt,
      userMessage,
      userId: "automation",
      maxTokens: 200,
      temperature: 0,
    });
    const parsed = parseJsonResponse<{ url?: string | null }>(result.text);
    const url = parsed.url;
    if (!url || typeof url !== "string") return null;
    // Basic URL validation
    if (!/^https?:\/\//.test(url)) return null;
    return url;
  } catch (err) {
    console.warn(`[refresh-annual-conferences] Claude lookup failed for ${evt.event}:`, err);
    return null;
  }
}

// ── core per-event logic ───────────────────────────────────────────

interface RefreshResult {
  eventName: string;
  strategy: "url-bump" | "claude" | "skipped";
  candidateAdded: boolean;
  skipReason?: string;
  candidateId?: string;
}

async function refreshConference(evt: CrmEvent): Promise<RefreshResult> {
  const today = new Date();
  const targetYear = today.getFullYear() + (today.getMonth() >= 6 ? 1 : 0);
  // If we're past July, look for next year; before July, look for this year.

  // First check: is there already a future edition in the DB?
  const existingCheck = await findDuplicateConference({
    name: evt.event,
    url: undefined,
  });
  // findDuplicateConference checks by name — if there's already a near-match,
  // a future edition may already exist. But we want to be more precise:
  // only skip if the found match has a future date. For now, if dedup returns
  // isDuplicate we assume the matching row covers the next edition.
  if (existingCheck.isDuplicate && existingCheck.existingId !== evt.id) {
    return {
      eventName: evt.event,
      strategy: "skipped",
      candidateAdded: false,
      skipReason: `already has a future row (${existingCheck.existingId})`,
    };
  }

  // Strategy 1: URL year-bump.
  let pageText: string | null = null;
  let candidateUrl: string | null = null;
  let strategy: RefreshResult["strategy"] = "skipped";

  if (evt.url) {
    const prevYear = targetYear - 1;
    // Try bumping to current year first (for upcoming conferences), then next.
    const yearsToTry = [targetYear, targetYear + 1];
    for (const y of yearsToTry) {
      const bumped = bumpUrlYear(evt.url, prevYear, y) ??
                     bumpUrlYear(evt.url, prevYear - 1, y);
      if (bumped && bumped !== evt.url) {
        const fetched = await tryFetch(bumped);
        if (fetched) {
          pageText = fetched;
          candidateUrl = bumped;
          strategy = "url-bump";
          break;
        }
      }
    }
  }

  // Strategy 2: Claude knowledge.
  if (!pageText) {
    const claudeUrl = await askClaudeForNextEdition(evt, targetYear);
    if (claudeUrl && claudeUrl !== evt.url) {
      const fetched = await tryFetch(claudeUrl);
      if (fetched) {
        pageText = fetched;
        candidateUrl = claudeUrl;
        strategy = "claude";
      }
    }
  }

  if (!pageText || !candidateUrl) {
    return {
      eventName: evt.event,
      strategy: "skipped",
      candidateAdded: false,
      skipReason: "no next edition URL found",
    };
  }

  // Dedup the found URL before triaging.
  const dedup = await findDuplicateConference({ name: evt.event, url: candidateUrl });
  if (dedup.isDuplicate && dedup.existingId !== evt.id) {
    return {
      eventName: evt.event,
      strategy,
      candidateAdded: false,
      skipReason: `duplicate of ${dedup.existingId}`,
    };
  }

  // Triage.
  const triage = await triageConference({
    title: evt.event,
    body: pageText,
    url: candidateUrl,
    discoveredVia: "annual-recurrence",
  });

  if (!triage.isConference) {
    return {
      eventName: evt.event,
      strategy,
      candidateAdded: false,
      skipReason: `triage rejected: ${triage.skipReason ?? "not a conference"}`,
    };
  }

  const newId = `disc_${crypto.randomUUID()}`;
  await upsertEventToSupabase(newId, {
    event: triage.conferenceName || evt.event,
    type: triage.type,
    event_start: triage.eventDates?.start ?? null,
    event_end: triage.eventDates?.end ?? null,
    proposal_deadline:
      triage.deadlines.find((d) => d.kind === "cfp_close")?.date ?? null,
    location: triage.location,
    est_attendance: triage.estAttendance,
    registration_cost: triage.registrationCost,
    why_it_matters: triage.whyItMatters,
    url: candidateUrl,
    // Inherit frequency + quadrant from the parent event.
    frequency: evt.frequency,
    quadrant_relevance: (evt.quadrantRelevance ?? []) as string[],
    who_should_attend: (evt.whoShouldAttend ?? []) as string[],
    status: "candidate",
    lifecycle_state: "upcoming",
    fit_score: triage.fitScore,
    triage_notes: triage.decisionNotes,
    discovered_via: "annual-recurrence",
    discovered_at: new Date().toISOString(),
    external_id: candidateUrl,
    raw_payload_json: {
      triage,
      parentEventId: evt.id,
      parentEventName: evt.event,
      strategy,
      fetchedAt: new Date().toISOString(),
    } as unknown,
    deadlines: triage.deadlines as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // Phase 16: kick off cover image in background.
  const coverUrl = `${process.env.PORT_URL ?? "https://port.windedvertigo.com"}/api/events/${newId}/cover`;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    after(
      fetch(coverUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      }).catch((err) =>
        console.warn("[refresh-annual-conferences] cover image kick-off failed:", err),
      ),
    );
  }

  return {
    eventName: evt.event,
    strategy,
    candidateAdded: true,
    candidateId: newId,
  };
}

// ── route handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Fetch all Annual + Biannual events (include not_relevant so dedup works).
  const { data: allEvents } = await getEventsFromSupabase(
    { includeNotRelevant: true },
    { pageSize: 500 },
  );

  const recurringPast = allEvents
    .filter(
      (e) =>
        (e.frequency === "Annual" || e.frequency === "Biannual") &&
        isPastEvent(e) &&
        // Skip rows that were themselves discovered by this cron (they ARE the
        // next edition) — only source from manually-entered or non-recurrence rows.
        e.discoveredVia !== "annual-recurrence",
    )
    .slice(0, EVENTS_PER_RUN);

  if (recurringPast.length === 0) {
    return NextResponse.json({ ok: true, message: "no past recurring events to refresh", processed: 0 });
  }

  const results: RefreshResult[] = [];
  for (const evt of recurringPast) {
    try {
      const result = await refreshConference(evt);
      results.push(result);
      console.log(
        `[refresh-annual-conferences] ${evt.event} — ${result.strategy}${
          result.candidateAdded ? " → added " + result.candidateId : " (skipped: " + result.skipReason + ")"
        }`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[refresh-annual-conferences] ${evt.event} failed:`, msg);
      results.push({ eventName: evt.event, strategy: "skipped", candidateAdded: false, skipReason: `error: ${msg}` });
    }
  }

  const added   = results.filter((r) => r.candidateAdded);
  const skipped = results.filter((r) => !r.candidateAdded);

  if (added.length > 0) {
    const names = added.map((r) => r.eventName).join(", ");
    await postToSlack(
      `annual-recurrence scout found ${added.length} next edition${added.length === 1 ? "" : "s"}: ${names} — review at https://port.windedvertigo.com/events?status=candidate`,
    );
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    candidatesAdded: added.length,
    skipped: skipped.length,
    results,
  });
}
