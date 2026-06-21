/**
 * port/lib/scheduled.ts
 *
 * CF Workers scheduled() handler — replaces Vercel cron jobs.
 *
 * Strategy: single hourly trigger (`0 * * * *` in wrangler.jsonc) acts as
 * a "cron router". Each invocation checks the current UTC time and dispatches
 * to the appropriate API route handlers via authenticated self-request.
 *
 * Why self-request instead of direct function import:
 *   - All 32 existing cron routes authenticate via `Authorization: Bearer CRON_SECRET`
 *   - Self-request preserves all handler code unchanged (no migration needed)
 *   - Route handlers already handle errors, logging, and idempotency internally
 *   - `ctx.waitUntil()` keeps the scheduled() handler fast while work continues
 *
 * Additionally handles the 2 Inngest-migrated cron functions (G.2.3):
 *   - submission-followup (was inngest cron `0 8 * * *`)
 *   - bd-asset-health (was inngest cron `0 9 * * 1`)
 *
 * Usage: add to port/wrangler.jsonc:
 *   "triggers": { "crons": ["0 * * * *"] }
 *
 * Migration status: 🔵 G.2.3 — implement when port moves to CF Workers (post Phase A.2 + G.2.1)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduledEnv {
  CRON_SECRET: string;
  // The Worker's own URL — set in wrangler.jsonc vars to avoid hardcoding
  PORT_URL: string;
}

// ── Cron schedule table ───────────────────────────────────────────────────────
// Maps UTC hour+minute+weekday patterns to route paths.
// Migrated from port/vercel.json (32 entries) + 2 Inngest cron functions.

interface CronEntry {
  /** API route path (GET request with CRON_SECRET auth) */
  path: string;
  /** UTC hours when this should run (undefined = every hour) */
  hours?: number[];
  /**
   * Original Vercel cron minute — for documentation only.
   * The CF hourly trigger fires at :00 so all jobs run at the top of
   * their designated hour. Sub-minute precision is not preserved.
   */
  originalMinute?: number;
  /** Day of week (0=Sun, 1=Mon … 6=Sat); undefined = all days */
  weekdays?: number[];
  /** Day of month; undefined = all days */
  dayOfMonth?: number;
}

// Phase A4 (2026-05-03): All 21 Notion→Supabase mirror crons retired.
// Supabase is now the write-primary source of truth (Phase A3 complete) so
// these one-way mirrors are redundant. Route files kept for reference but
// no longer scheduled. Kept crons:
//   sync-allowances    — business logic (creates reimbursement entries), not a mirror
//   sync-calendar-time — GCal → timesheets sync (orthogonal to Notion migration)
//   sync-replies       — sends email replies (not a data mirror)

const CRON_TABLE: CronEntry[] = [
  // ── Hourly (Council GCal sync — W4) ─────────────────────────────────────────
  // Pulls upcoming events for the next 7 days, creates pending Council records,
  // and appends the council URL to each event description. Idempotent.
  { path: "/api/cron/gcal-sync" },

  // ── Hourly (Council Meet AI transcript ingest — W4 final) ──────────────────
  // Watches the Drive Meet Recordings folder, parses new "Notes by Gemini"
  // docs, extracts action items via Claude, and merges into the pending
  // Council meeting record (by gcal_event_id). Idempotent (transcript_doc_id).
  { path: "/api/cron/meet-transcript-ingest" },

  // ── Daily at fixed times ────────────────────────────────────────────────────
  { path: "/api/cron/rfp-gmail-scanner",   hours: [8] },
  { path: "/api/rfp-radar/poll-rss",       hours: [8], originalMinute: 15 },
  { path: "/api/rfp-radar/poll-feedly",    hours: [8], originalMinute: 30 },
  { path: "/api/cron/sync-replies",        hours: [8], originalMinute: 55 },
  { path: "/api/cron/campaigns",           hours: [9], originalMinute: 7 },
  { path: "/api/cron/relationship-alerts", hours: [13] },
  { path: "/api/cron/deadline-reminders",  hours: [12] },

  // ── Inngest cron migrations ─────────────────────────────────────────────────
  { path: "/api/cron/submission-followup", hours: [8] },
  { path: "/api/cron/bd-asset-health",     hours: [9], weekdays: [1] },
  { path: "/api/cron/fin-email-scan",      hours: [7] },
  { path: "/api/cron/fin-box-scan",        hours: [8] },

  // ── Weekday-only ────────────────────────────────────────────────────────────
  { path: "/api/cron/meeting-briefings",   hours: [11], originalMinute: 30, weekdays: [1,2,3,4,5] },
  { path: "/api/cron/morning-digest",      hours: [9],  weekdays: [1,2,3,4,5] },
  { path: "/api/cron/sync-calendar-time",  hours: [14], weekdays: [1,2,3,4,5] },
  { path: "/api/cron/deadline-risk",       hours: [13], originalMinute: 30, weekdays: [1,2,3,4,5] },
  { path: "/api/cron/biz-go-no-go-sweep", hours: [8],                      weekdays: [1,2,3,4,5] },

  // ── Monday-only ─────────────────────────────────────────────────────────────
  { path: "/api/cron/weekly-digest",    hours: [14], weekdays: [1] },
  { path: "/api/gusto/sync",            hours: [13], weekdays: [1] },
  { path: "/api/cron/generate-pdfs",    hours: [6],  weekdays: [1] },
  { path: "/api/cron/payroll-reminder", hours: [9],  dayOfMonth: 26 },

  // ── Monthly (specific day) ──────────────────────────────────────────────────
  { path: "/api/cron/refresh-linkedin",  hours: [9], dayOfMonth: 1 },
  { path: "/api/cron/linkedin-monitor",  hours: [9], dayOfMonth: 5 },
  { path: "/api/cron/sync-allowances",   hours: [9], dayOfMonth: 28 },
  // Mirror for the allowances table (Notion→Supabase); the above creates
  // reimbursement entries (business logic). Both run on the 28th.
  { path: "/api/cron/sync-allowances-pilot", hours: [9], dayOfMonth: 28 },

  // ── Every 4 hours ───────────────────────────────────────────────────────────
  { path: "/api/cron/ingest-meeting-notes", hours: [0,4,8,12,16,20] },

  // ── Daily safety-net mirror Notion → Supabase for crm_events.
  //    Restored 2026-05-08 after Phase A4 retirement left the events tab
  //    blank (0 rows in Supabase). UPSERT-only, so port-UI edits aren't
  //    clobbered. Retire once discovery feeds are live + the team works
  //    exclusively from the port UI for ≥4 weeks.
  { path: "/api/cron/sync-events-pilot", hours: [7] },

  // ── Daily safety-net mirror Notion → Supabase for competitors.
  //    Restored 2026-05-08 after Phase A4 retirement zeroed the table.
  //    UPSERT-only on notion_page_id — safe to run alongside port edits.
  { path: "/api/cron/sync-competitors-pilot", hours: [7] },

  // ── PM + BD asset syncs (re-added 2026-05-19) ─────────────────────────────────
  // Accidentally dropped from CRON_TABLE in Phase A4. Same pattern as the
  // events/competitors/campaigns syncs restored on 2026-05-09. Supabase tables
  // were empty; the pages were showing blank. Notion is still the write layer.

  // Projects: hourly — project status + timeline changes frequently
  { path: "/api/cron/sync-projects-pilot" },

  // Work items: every 2 hours — tasks change throughout the day
  { path: "/api/cron/sync-work-items", hours: [0,2,4,6,8,10,12,14,16,18,20,22] },

  // Milestones: every 2 hours — less frequent than tasks but same ballpark
  { path: "/api/cron/sync-milestones-pilot", hours: [1,3,5,7,9,11,13,15,17,19,21,23] },

  // Cycles: daily at 5am UTC — cycles rarely change mid-day
  { path: "/api/cron/sync-cycles-pilot", hours: [5] },

  // BD Assets: daily at 6am UTC — assets change infrequently
  { path: "/api/cron/sync-bd-assets-pilot", hours: [6] },

  // ── Notion dual-write pilots (still active; added to CRON_TABLE 2026-05-09) ──
  // These six Notion→Supabase syncs were accidentally dropped from CRON_TABLE
  // during Phase A4. They were still running on Vercel (vercel.json schedules).
  // Re-added here so they continue after wv-crm is deprovisioned (post-2026-05-17).

  // Campaigns + steps + RFP: hourly (Vercel was `0 * * * *`) — keep Supabase
  // tables fresh for port reads while Payton's team still edits in Notion.
  { path: "/api/cron/sync-campaigns-pilot" },
  { path: "/api/cron/sync-campaign-steps-pilot" },
  { path: "/api/cron/sync-rfp-pilot" },

  // RFP feeds: daily 09:00 UTC
  { path: "/api/cron/sync-rfp-feeds-pilot", hours: [9] },

  // Members: daily 02:00 UTC (low-traffic hour; nightly refresh sufficient)
  { path: "/api/cron/sync-members-pilot", hours: [2] },

  // Blueprints: daily 05:00 UTC
  { path: "/api/cron/sync-blueprints-pilot", hours: [5] },

  // ── Conference intelligence pipeline (2026-05-08) ───────────────────────────
  // Three discovery sources feeding the events tab as `status='candidate'`.
  // Phases 4, 5, 9 of the conference intelligence plan; see lib/ai/conference-triage.ts
  // and lib/conferences/dedup.ts for the shared ingest pipeline.

  // Daily 06:30 UTC — scan curated newsletter senders in each team mailbox.
  // Highest-signal feeder. STRICT allowlist — privacy guardrail enforced
  // inside the route. originalMinute documents the original Vercel cadence
  // even though the hourly router fires at :00.
  { path: "/api/cron/scan-conference-newsletters", hours: [6], originalMinute: 30 },

  // Weekly Mondays 14:00 UTC — for each org in `organizations`, ask AI what
  // conferences that org hosts/sponsors/attends. Rate-limited to 10 orgs per
  // run, rotating through least-recently-scouted orgs across weeks.
  { path: "/api/cron/scout-org-conferences", hours: [14], weekdays: [1] },

  // Monthly 1st-of-month 14:30 UTC — broad WV_PROFILE topic scout for
  // green-field conferences the org-affiliated and newsletter scans don't
  // cover. Capped at 10 candidates/run, lower confidence by design.
  { path: "/api/cron/scout-broad-conferences", hours: [14], originalMinute: 30, dayOfMonth: 1 },

  // Weekly Saturdays 09:00 UTC — re-scout Annual/Biannual conferences once
  // their last known edition has passed. Tries URL year-bump first (free),
  // falls back to Claude knowledge lookup. Inserts next editions as candidates.
  { path: "/api/cron/refresh-annual-conferences", hours: [9], weekdays: [6] },

  // Daily 04:00 UTC — refresh social stats snapshot (Substack, LinkedIn,
  // Bluesky). Restored in Phase 17 after the three null stubs were wired up
  // with real API calls. Meta stays stub (pending PAGE_ACCESS_TOKEN approval).
  { path: "/api/cron/sync-social-stats", hours: [4] },

  // Daily 13:00 UTC — cARL's lifelong-learning run: searches the live literature,
  // grounds findings in real papers, files them to the bibliography, delivers
  // Mo/Pam-track insights to their dashboards, and self-replenishes its
  // curriculum. Cheap (Haiku + free search); cost tracked under "carl-study".
  { path: "/api/cron/carl-study", hours: [13] },

  // Daily 06:00 UTC — Opsy tier-4 security & compliance (DNS email auth,
  // supabase RLS audit). Tiers 1-3 + email scan run on the */5 trigger below.
  { path: "/api/cron/opsy-health-check-t4", hours: [6] },

  // Monday 07:00 UTC — Opsy weekly ops digest + pattern-detection learning
  // pass. Posts to #ops-alerts.
  { path: "/api/cron/opsy-digest", hours: [7], weekdays: [1] },
];

// Every-5-minutes jobs — handled by the */5 trigger, NOT via CRON_TABLE
// (the hourly router would under-fire them to once per hour).
//   sweep-stuck-proposals  — proposal pipeline watchdog
//   opsy-health-check-t1   — Opsy tier-1 platform probes (posture.md tier 1)
const FIVE_MINUTE_PATHS = [
  "/api/cron/sweep-stuck-proposals",
  "/api/cron/opsy-health-check-t1",
];

// Sub-hourly Opsy jobs ride the same */5 trigger, slotted by the scheduled
// minute (controller.scheduledTime, so a delayed invocation can't miss its
// slot): :00/:15/:30/:45 → tier 2 + email scan; :00/:30 → tier 3.
const FIFTEEN_MINUTE_PATHS = [
  "/api/cron/opsy-health-check-t2",
  "/api/cron/opsy-email-scan",
];
const THIRTY_MINUTE_PATHS = ["/api/cron/opsy-health-check-t3"];

// ── Dispatch logic ────────────────────────────────────────────────────────────

function shouldRun(entry: CronEntry, now: Date): boolean {
  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay();
  const utcDate = now.getUTCDate();

  // Hourly trigger always fires at :00 — originalMinute is documentation only.
  // All jobs fire at the top of their designated hour(s).
  if (entry.dayOfMonth !== undefined && utcDate !== entry.dayOfMonth) return false;
  if (entry.weekdays !== undefined && !entry.weekdays.includes(utcDay)) return false;
  if (entry.hours !== undefined && !entry.hours.includes(utcHour)) return false;

  return true;
}

/**
 * Report a failed dispatch to Opsy's cron watchdog, which records it and
 * auto-retries once (POST /api/opsy/cron-failure). Fire-and-forget; never
 * reports its own failures (no recursion) and never throws into dispatch.
 */
function reportCronFailure(
  path: string,
  status: number | null,
  error: string | null,
  env: ScheduledEnv,
): Promise<void> {
  if (path.startsWith("/api/opsy/cron-failure")) return Promise.resolve();
  return fetch(`${env.PORT_URL}/api/opsy/cron-failure`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, status, error }),
  })
    .then(() => undefined)
    .catch((err) => {
      console.error(`[scheduled] cron-failure report for ${path} failed:`, err);
    });
}

async function dispatch(
  entry: CronEntry,
  env: ScheduledEnv,
  ctx: ExecutionContext,
): Promise<void> {
  const url = `${env.PORT_URL}${entry.path}`;
  ctx.waitUntil(
    fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    }).then(async (res) => {
      if (!res.ok) {
        console.error(`[scheduled] ${entry.path} → ${res.status}`);
        await reportCronFailure(entry.path, res.status, null, env);
      }
    }).catch(async (err) => {
      console.error(`[scheduled] ${entry.path} fetch error:`, err);
      await reportCronFailure(entry.path, null, err instanceof Error ? err.message : String(err), env);
    }),
  );
}

// ── Main scheduled handler ────────────────────────────────────────────────────

export async function scheduled(
  controller: ScheduledController,
  env: ScheduledEnv,
  ctx: ExecutionContext,
): Promise<void> {
  // 5-minute jobs fire on their own */5 trigger — dispatch immediately and
  // return. The hourly router does not run them. 15/30-minute jobs slot off
  // the scheduled minute of the same trigger.
  if (controller.cron === "*/5 * * * *") {
    const minute = new Date(controller.scheduledTime).getUTCMinutes();
    for (const path of FIVE_MINUTE_PATHS) {
      await dispatch({ path }, env, ctx);
    }
    if (minute % 15 === 0) {
      for (const path of FIFTEEN_MINUTE_PATHS) {
        await dispatch({ path }, env, ctx);
      }
    }
    if (minute % 30 === 0) {
      for (const path of THIRTY_MINUTE_PATHS) {
        await dispatch({ path }, env, ctx);
      }
    }
    return;
  }

  // All other triggers go through the hourly routing table
  const now = new Date();
  for (const entry of CRON_TABLE) {
    if (shouldRun(entry, now)) {
      await dispatch(entry, env, ctx);
    }
  }
}
