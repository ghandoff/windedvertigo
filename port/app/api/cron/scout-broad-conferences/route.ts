/**
 * GET /api/cron/scout-broad-conferences
 *
 * Phase 9 — broad topic scout (monthly backstop).
 *
 * Low-volume safety net for the conference intelligence pipeline. Asks Claude
 * (Haiku, via the existing `conference-triage` feature routing) for upcoming
 * conferences in w.v's domain — green-field events that the org-affiliated
 * scout (Phase 4) and inbox newsletter scan (Phase 5) won't surface because
 * they aren't tied to an active client org or a curated newsletter sender.
 *
 * Distinct from the org-affiliated scout in three ways:
 *   1. Uses the WV_PROFILE topic profile, not per-org context.
 *   2. No `affiliated_org_id` is stamped — these are unaffiliated by design.
 *   3. Lower confidence by default — review with extra skepticism. The
 *      `?discoveredVia=broad-scout` filter on the events tab makes this
 *      explicit so reviewers know to double-check fit before promoting.
 *
 * Hard cap of 10 candidates per run after dedup; any larger list from the
 * model is sliced. The cron is meant to fire on the first Monday of each
 * month at 14:30 UTC (registered separately in lib/scheduled.ts after the
 * three parallel-built crons land).
 *
 * Auth: Authorization: Bearer {CRON_SECRET}.
 *
 * Required env vars:
 *   - CRON_SECRET                — bearer auth for this route
 *   - ANTHROPIC_API_KEY (or AI Gateway equivalent) — for callClaude
 *   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — for crm_events upserts
 *   - SLACK_WEBHOOK_URL          — optional, for the per-run summary post
 */

import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { WV_PROFILE } from "@/lib/ai/wv-profile";
import { triageConference } from "@/lib/ai/conference-triage";
import { findDuplicateConference } from "@/lib/conferences/dedup";
import { upsertEventToSupabase } from "@/lib/supabase/events";
import { postToSlack } from "@/lib/slack";

export const maxDuration = 180;

// ── tunables ──────────────────────────────────────────────────────

/** Hard cap on candidates considered per run after dedup. */
const MAX_CANDIDATES_PER_RUN = 10;

// ── types ─────────────────────────────────────────────────────────

interface ScoutedConference {
  name: string;
  url: string;
  dates: string;
  location: string;
  why_relevant: string;
  domains: string[];
}

interface ScoutResponse {
  conferences: ScoutedConference[];
}

interface RunSummary {
  ok: boolean;
  candidatesProposed: number;
  candidatesAdded: number;
  skipped: { duplicate: number; notConference: number };
  errors: string[];
}

// ── helpers ───────────────────────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Stable sort key so the slice-to-10 is deterministic across runs. */
function candidateSortKey(c: ScoutedConference): string {
  return `${(c.name ?? "").toLowerCase()}|${(c.url ?? "").toLowerCase()}`;
}

async function fetchScoutedConferences(): Promise<ScoutedConference[]> {
  const systemPrompt = `You are a research assistant for winded.vertigo (w.v).
${WV_PROFILE}

Find 5-15 upcoming conferences/summits/symposia in the next 6 months
that fit w.v's domains and sectors. Focus on: learning sciences,
curriculum design, MEL/evaluation, play research, international
development education, behavioral economics in education, ed-tech
pedagogy, dashboards/analytics for learning.

Avoid:
- conferences w.v's existing client orgs (PRME, IDB, UNICEF, Sesame
  Workshop, LEGO/LEF) directly host or sponsor — those are covered
  by other discovery channels
- pure technology / IT conferences
- construction, healthcare delivery, legal, marketing/PR conferences

Return STRICT JSON: {"conferences": [{
  "name": "...",
  "url": "https://...",
  "dates": "YYYY-MM-DD or 'TBA'",
  "location": "city, country",
  "why_relevant": "1-2 sentences why this fits w.v's expertise",
  "domains": ["domain1", "domain2"]
}]}`;

  const userMessage = `Today's date: ${todayIso()}.
Return your JSON now.`;

  const result = await callClaude({
    feature: "conference-triage",
    system: systemPrompt,
    userMessage,
    userId: "automation",
    maxTokens: 2000,
    temperature: 0.2,
  });

  const parsed = parseJsonResponse<ScoutResponse>(result.text);
  if (!parsed || !Array.isArray(parsed.conferences)) {
    throw new Error("scout response missing conferences[]");
  }
  return parsed.conferences.filter((c) => c && c.name && c.url);
}

// ── handler ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary: RunSummary = {
    ok: true,
    candidatesProposed: 0,
    candidatesAdded: 0,
    skipped: { duplicate: 0, notConference: 0 },
    errors: [],
  };

  // 1. Single Claude call for the candidate list.
  let scouted: ScoutedConference[];
  try {
    scouted = await fetchScoutedConferences();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scout-broad-conferences] scout call failed:", msg);
    return NextResponse.json(
      { ...summary, ok: false, errors: [`scout call failed: ${msg}`] },
      { status: 500 },
    );
  }

  summary.candidatesProposed = scouted.length;

  // 2. Sort deterministically, then walk the list. Dedup is per-candidate
  // so we can apply the 10-cap to *survivors*, not to the raw model output.
  const ordered = [...scouted].sort((a, b) =>
    candidateSortKey(a).localeCompare(candidateSortKey(b)),
  );

  const survivors: ScoutedConference[] = [];
  for (const cand of ordered) {
    if (survivors.length >= MAX_CANDIDATES_PER_RUN) break;
    try {
      const dup = await findDuplicateConference({ name: cand.name, url: cand.url });
      if (dup.isDuplicate) {
        summary.skipped.duplicate += 1;
        continue;
      }
      survivors.push(cand);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`dedup ${cand.name}: ${msg}`);
    }
  }

  // 3. Triage + upsert each survivor under its own try/catch.
  const scoutedAt = new Date().toISOString();
  for (const cand of survivors) {
    try {
      const triage = await triageConference({
        title: cand.name,
        body: `${cand.why_relevant}\n\nDates: ${cand.dates}\nLocation: ${cand.location}\nDomains: ${(cand.domains ?? []).join(", ")}`,
        url: cand.url,
        discoveredVia: "broad-scout",
      });

      if (!triage.isConference) {
        summary.skipped.notConference += 1;
        continue;
      }

      const newId = `disc_${crypto.randomUUID()}`;

      await upsertEventToSupabase(newId, {
        event: triage.conferenceName || cand.name,
        type: triage.type,
        event_start: triage.eventDates?.start ?? null,
        event_end: triage.eventDates?.end ?? null,
        location: triage.location || cand.location || null,
        est_attendance: triage.estAttendance || null,
        registration_cost: triage.registrationCost || null,
        why_it_matters: triage.whyItMatters || cand.why_relevant || null,
        url: triage.url || cand.url || null,
        status: "candidate",
        lifecycle_state: "upcoming",
        fit_score: triage.fitScore ?? null,
        triage_notes: triage.decisionNotes ?? null,
        discovered_via: "broad-scout",
        discovered_at: scoutedAt,
        affiliated_org_id: null,
        deadlines: triage.deadlines ?? [],
        raw_payload_json: {
          triage,
          scoutedConference: cand,
          scoutedAt,
        },
      });

      summary.candidatesAdded += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[scout-broad-conferences] candidate ${cand.name} failed:`, msg);
      summary.errors.push(`${cand.name}: ${msg}`);
    }
  }

  // 4. Slack ping when there's something to look at.
  if (summary.candidatesAdded > 0) {
    await postToSlack(
      `broad scout proposed ${summary.candidatesAdded} unaffiliated conferences worth a skeptical look — review at https://port.windedvertigo.com/events?status=candidate&discoveredVia=broad-scout`,
    );
  }

  console.log(
    `[scout-broad-conferences] proposed=${summary.candidatesProposed} added=${summary.candidatesAdded} dup=${summary.skipped.duplicate} notConf=${summary.skipped.notConference} errors=${summary.errors.length}`,
  );

  return NextResponse.json(summary);
}
