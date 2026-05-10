/**
 * GET /api/cron/scout-org-conferences
 *
 * Phase 4 of the conference intelligence pipeline: weekly org-affiliated scout.
 *
 * Iterates the existing `organizations` table, asks Claude what
 * conferences each org hosts/sponsors/regularly attends, then ingests new
 * candidates via the existing triage+dedup pipeline. Lands rows with
 * `discovered_via='org-affiliated'` and `affiliated_org_id=<org.id>` so the
 * events tab can surface them under the originating org.
 *
 * Why weekly + 10-org cap: per-org research calls are expensive (one Claude
 * call per org, each potentially producing 3-7 follow-up triage calls). The
 * route picks the 10 LEAST-RECENTLY-SCOUTED orgs each run so the full org
 * table rotates through over multiple weeks instead of re-hitting the same
 * top-of-list orgs every time.
 *
 * Runs weekly via lib/scheduled.ts CRON_TABLE (registered separately by the
 * parent agent after Phases 4-6 land in parallel).
 *
 * Auth: Authorization: Bearer {CRON_SECRET}.
 *
 * Env vars required:
 *   CRON_SECRET            — shared secret for cron auth
 *   ANTHROPIC_API_KEY      — via the existing callClaude wrapper
 *   SUPABASE_*             — via lib/supabase/client
 *   SLACK_WEBHOOK_URL      — optional, for the run summary post
 */

import { NextRequest, NextResponse, after } from "next/server";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { triageConference } from "@/lib/ai/conference-triage";
import { WV_PROFILE } from "@/lib/ai/wv-profile";
import { findDuplicateConference } from "@/lib/conferences/dedup";
import { upsertEventToSupabase } from "@/lib/supabase/events";
import { getOrganizationsFromSupabase } from "@/lib/supabase/organizations";
import { supabase } from "@/lib/supabase/client";
import { postToSlack } from "@/lib/slack";
import type { Organization } from "@/lib/notion/types";

export const maxDuration = 300;

const ORGS_PER_RUN = 10;

// ── types ─────────────────────────────────────────────────────────

interface ScoutedConference {
  name: string;
  url: string;
  dates: string;
  location: string;
  why_relevant: string;
  affiliation_type: "host" | "sponsor" | "attendee" | "partner";
}

interface OrgScoutResult {
  candidatesAdded: number;
  conferencesProposed: number;
  skipped: number;
}

// ── helpers ───────────────────────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

/**
 * Pick the N least-recently-scouted orgs.
 *
 * Reads `crm_events` rows that already have `affiliated_org_id` set, groups by
 * org id, and finds the most recent `discovered_at` per org. Orgs that have
 * NEVER been scouted are surfaced first (no row in the map). Among already-
 * scouted orgs, those with the oldest most-recent scout come next.
 *
 * If total org count <= ORGS_PER_RUN, returns all orgs.
 */
async function pickLeastRecentlyScoutedOrgs(
  limit: number,
): Promise<Organization[]> {
  // Pull all orgs (the org table is small — a few hundred rows max).
  const { data: orgs } = await getOrganizationsFromSupabase({}, { page: 1, pageSize: 500 });
  if (orgs.length <= limit) return orgs;

  // Build a map: org id -> most recent discovered_at on an org-affiliated row.
  const { data: scoutRows, error } = await supabase
    .from("crm_events")
    .select("affiliated_org_id, discovered_at")
    .eq("discovered_via", "org-affiliated")
    .not("affiliated_org_id", "is", null)
    .order("discovered_at", { ascending: false });

  if (error) {
    console.warn(
      "[scout-org-conferences] could not read scout history, falling back to first N orgs:",
      error.message,
    );
    return orgs.slice(0, limit);
  }

  const lastScoutByOrg = new Map<string, string>();
  for (const row of (scoutRows ?? []) as { affiliated_org_id: string; discovered_at: string | null }[]) {
    if (!row.affiliated_org_id) continue;
    if (!lastScoutByOrg.has(row.affiliated_org_id)) {
      lastScoutByOrg.set(row.affiliated_org_id, row.discovered_at ?? "");
    }
  }

  // Sort: never-scouted first (empty string), then oldest scout date ascending.
  const sorted = [...orgs].sort((a, b) => {
    const aScout = lastScoutByOrg.get(a.id) ?? "";
    const bScout = lastScoutByOrg.get(b.id) ?? "";
    return aScout.localeCompare(bScout);
  });

  return sorted.slice(0, limit);
}

/**
 * Ask Claude what conferences this org hosts/sponsors/attends.
 * Returns an empty list if the response is unparseable.
 */
async function scoutConferencesForOrg(
  org: Organization,
): Promise<ScoutedConference[]> {
  const systemPrompt = `You are a research assistant for winded.vertigo (w.v).

${WV_PROFILE}

Given an organization, list 3-7 conferences/summits/symposia it hosts,
sponsors, regularly attends, or is closely affiliated with.

Return STRICT JSON: {"conferences": [{
  "name": "...",
  "url": "https://...",
  "dates": "YYYY-MM-DD or 'TBA'",
  "location": "city, country",
  "why_relevant": "1-2 sentences why this org is associated with this event",
  "affiliation_type": "host" | "sponsor" | "attendee" | "partner"
}]}`;

  const categories = (org.category ?? []).join(", ") || "(none)";
  const userMessage = `Organization: ${org.organization}
About: ${org.description ?? "(no description)"}
Categories: ${categories}
Website: ${org.website || "(unknown)"}`;

  const result = await callClaude({
    feature: "conference-triage",
    system: systemPrompt,
    userMessage,
    userId: "automation",
    maxTokens: 1500,
    temperature: 0.2,
  });

  try {
    const parsed = parseJsonResponse<{ conferences?: ScoutedConference[] }>(result.text);
    return Array.isArray(parsed.conferences) ? parsed.conferences : [];
  } catch (err) {
    console.warn(
      `[scout-org-conferences] failed to parse Claude response for org ${org.id}:`,
      err,
    );
    return [];
  }
}

/**
 * Process one scouted conference: dedup, triage, upsert. Returns whether a
 * candidate row was added.
 */
async function ingestScoutedConference(
  org: Organization,
  conference: ScoutedConference,
): Promise<{ added: boolean; reason?: string }> {
  if (!conference.name || !conference.url) {
    return { added: false, reason: "missing name or url" };
  }

  // 1. Dedup against existing rows.
  const dup = await findDuplicateConference({
    name: conference.name,
    url: conference.url,
  });
  if (dup.isDuplicate) {
    return { added: false, reason: `duplicate (matched on ${dup.matchedOn})` };
  }

  // 2. Triage to extract structured fields + fit score.
  const triage = await triageConference({
    title: conference.name,
    body: conference.why_relevant,
    url: conference.url,
    discoveredVia: "org-affiliated",
  });

  if (!triage.isConference) {
    return {
      added: false,
      reason: `triage rejected: ${triage.skipReason ?? "not a conference"}`,
    };
  }

  // 3. Upsert candidate row.
  const newId = `disc_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await upsertEventToSupabase(newId, {
    event: triage.conferenceName || conference.name,
    type: triage.type,
    event_start: triage.eventDates?.start ?? null,
    event_end: triage.eventDates?.end ?? null,
    location: triage.location || conference.location || null,
    url: triage.url || conference.url || null,
    status: "candidate",
    lifecycle_state: "upcoming",
    fit_score: triage.fitScore,
    triage_notes: triage.decisionNotes,
    why_it_matters: triage.whyItMatters,
    discovered_via: "org-affiliated",
    discovered_at: now,
    affiliated_org_id: org.id,
    external_id: triage.url || conference.url,
    raw_payload_json: {
      triage,
      scoutedConference: conference,
      scoutedAt: now,
    },
    deadlines: triage.deadlines ?? [],
  });

  // Phase 16: kick off cover image generation in background (non-blocking).
  // Uses after() so the cron response isn't delayed by the fetch+R2 upload.
  const coverUrl = `${process.env.PORT_URL ?? "https://port.windedvertigo.com"}/api/events/${newId}/cover`;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    after(
      fetch(coverUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      }).catch((err) =>
        console.warn("[scout-org-conferences] cover image kick-off failed:", err),
      ),
    );
  }

  return { added: true };
}

// ── main handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await pickLeastRecentlyScoutedOrgs(ORGS_PER_RUN);

  const byOrg: Record<string, OrgScoutResult> = {};
  const errors: { orgId: string; message: string }[] = [];
  let candidatesAdded = 0;

  for (const org of orgs) {
    const summary: OrgScoutResult = {
      candidatesAdded: 0,
      conferencesProposed: 0,
      skipped: 0,
    };

    try {
      const conferences = await scoutConferencesForOrg(org);
      summary.conferencesProposed = conferences.length;

      for (const conference of conferences) {
        try {
          const result = await ingestScoutedConference(org, conference);
          if (result.added) {
            summary.candidatesAdded += 1;
            candidatesAdded += 1;
          } else {
            summary.skipped += 1;
            console.log(
              `[scout-org-conferences] skipped ${conference.name} for ${org.organization}: ${result.reason}`,
            );
          }
        } catch (err) {
          summary.skipped += 1;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[scout-org-conferences] error ingesting ${conference.name} for ${org.organization}: ${msg}`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[scout-org-conferences] error scouting org ${org.id} (${org.organization}): ${msg}`,
      );
      errors.push({ orgId: org.id, message: msg });
    }

    byOrg[org.id] = summary;
  }

  // Optional Slack summary — only when something actually landed.
  if (candidatesAdded > 0) {
    const url = "https://port.windedvertigo.com/events?status=candidate";
    await postToSlack(
      `scout linked ${candidatesAdded} new conferences to existing orgs — review at ${url}`,
    );
  }

  return NextResponse.json({
    ok: true,
    scoutedOrgs: orgs.length,
    candidatesAdded,
    byOrg,
    errors,
  });
}
