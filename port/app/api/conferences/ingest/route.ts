/**
 * POST /api/conferences/ingest
 *
 * Single-URL ingest path. Used by:
 *   1. wv-claw bot DM handler ("add conference https://...")
 *   2. The "+ ingest URL" dialog on the events tab toolbar (Phase 3 optional)
 *   3. Future RSS-feed-poller per-item path (Phase 5)
 *
 * Flow:
 *   1. Auth (bearer CRON_SECRET for bots, Auth.js session for UI).
 *   2. Fetch the URL with a browser UA → extract title + body text.
 *   3. Run conference-triage (AI fit-score + structured extraction).
 *   4. If triage says NOT a conference → 200 with skipped:true (audit only).
 *   5. Dedup against crm_events (URL + Levenshtein name).
 *   6. If new, upsert as status='candidate' with discoveredVia provenance.
 *
 * Returns:
 *   { created, skipped, dedupedTo?, eventId?, triage, dedup, fetchedAt }
 *
 * Cost-controlled: Haiku, 3000-char body cap inside conference-triage.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { triageConference } from "@/lib/ai/conference-triage";
import { findDuplicateConference } from "@/lib/conferences/dedup";
import { upsertEventToSupabase } from "@/lib/supabase/events";
import { auth } from "@/lib/auth";
import type { ConferenceDiscoverySource } from "@/lib/notion/types";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function hasCronAuth(req: NextRequest): boolean {
  const a = req.headers.get("authorization");
  if (!a) return false;
  return a.replace("Bearer ", "") === process.env.CRON_SECRET;
}

interface IngestBody {
  url: string;
  /** Override the discovery provenance — defaults to 'slack-paste' (the
   *  most common UI for this endpoint). RSS poller will pass 'newsletter',
   *  org scout will pass 'org-affiliated', etc. */
  discoveredVia?: ConferenceDiscoverySource;
  /** When called from a discovery cron, the org row that triggered the
   *  scout. Optional, persists as affiliated_org_id. */
  affiliatedOrgId?: string;
}

export async function POST(req: NextRequest) {
  // ── auth ────────────────────────────────────────────────
  let authedAs: string | null = null;
  if (hasCronAuth(req)) {
    authedAs = "cron";
  } else {
    const session = await auth();
    if (session?.user?.email?.endsWith("@windedvertigo.com")) {
      authedAs = session.user.email;
    }
  }
  if (!authedAs) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── body ────────────────────────────────────────────────
  const body = (await req.json().catch(() => null)) as IngestBody | null;
  if (!body?.url || !/^https?:\/\//.test(body.url)) {
    return NextResponse.json(
      { error: "url is required and must start with http(s)://" },
      { status: 400 },
    );
  }
  const discoveredVia: ConferenceDiscoverySource = body.discoveredVia ?? "slack-paste";

  // ── fetch the page ──────────────────────────────────────
  let pageText = "";
  let pageTitle = "";
  try {
    const res = await fetch(body.url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `fetch failed (${res.status})`, url: body.url },
        { status: 422 },
      );
    }
    pageText = await res.text();
    // Best-effort title extraction — conference-triage will refine it from body.
    pageTitle =
      pageText.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
      pageText.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ??
      "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `fetch error: ${msg}` }, { status: 500 });
  }

  // ── triage ──────────────────────────────────────────────
  let triage;
  try {
    triage = await triageConference({
      title: pageTitle || body.url,
      body: pageText,
      url: body.url,
      discoveredVia,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `triage failed: ${msg}` }, { status: 500 });
  }

  if (!triage.isConference) {
    return NextResponse.json({
      created: false,
      skipped: true,
      reason: triage.skipReason ?? "not a conference",
      triage,
    });
  }

  // ── dedup ───────────────────────────────────────────────
  const dedup = await findDuplicateConference({
    name: triage.conferenceName,
    url: triage.url || body.url,
  });
  if (dedup.isDuplicate) {
    return NextResponse.json({
      created: false,
      skipped: true,
      reason: `duplicate (matched on ${dedup.matchedOn})`,
      dedupedTo: dedup.existingId,
      triage,
    });
  }

  // ── insert as candidate ─────────────────────────────────
  // notion_page_id is the existing primary identifier. For
  // discovery-originated rows we generate a stable id; future Notion
  // mirror writes can replace it with the Notion page id.
  const newId = `disc_${crypto.randomUUID()}`;
  try {
    await upsertEventToSupabase(newId, {
      event: triage.conferenceName,
      type: triage.type,
      event_start: triage.eventDates?.start ?? null,
      event_end: triage.eventDates?.end ?? null,
      proposal_deadline:
        triage.deadlines.find((d) => d.kind === "cfp_close")?.date ?? null,
      location: triage.location,
      est_attendance: triage.estAttendance,
      registration_cost: triage.registrationCost,
      why_it_matters: triage.whyItMatters,
      url: triage.url || body.url,
      // Phase 1 columns
      status: "candidate",
      lifecycle_state: "upcoming",
      fit_score: triage.fitScore,
      triage_notes: triage.decisionNotes,
      discovered_via: discoveredVia,
      discovered_at: new Date().toISOString(),
      external_id: body.url,
      raw_payload_json: { triage, fetchedAt: new Date().toISOString() } as unknown,
      affiliated_org_id: body.affiliatedOrgId ?? null,
      deadlines: triage.deadlines as unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `upsert failed: ${msg}` }, { status: 500 });
  }

  // Phase 16: kick off cover image generation in background (non-blocking).
  const coverUrl = `${process.env.PORT_URL ?? "https://port.windedvertigo.com"}/api/events/${newId}/cover`;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    after(
      fetch(coverUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      }).catch((err) =>
        console.warn("[conferences/ingest] cover image kick-off failed:", err),
      ),
    );
  }

  return NextResponse.json({
    created: true,
    eventId: newId,
    discoveredVia,
    triagedBy: authedAs,
    triage: {
      conferenceName: triage.conferenceName,
      fitScore: triage.fitScore,
      eventDates: triage.eventDates,
      location: triage.location,
    },
    fetchedAt: new Date().toISOString(),
  });
}
