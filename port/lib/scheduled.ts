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

  // ── Weekday-only ────────────────────────────────────────────────────────────
  { path: "/api/cron/meeting-briefings",   hours: [11], originalMinute: 30, weekdays: [1,2,3,4,5] },
  { path: "/api/cron/morning-digest",      hours: [9],  weekdays: [1,2,3,4,5] },
  { path: "/api/cron/sync-calendar-time",  hours: [14], weekdays: [1,2,3,4,5] },
  { path: "/api/cron/deadline-risk",       hours: [13], originalMinute: 30, weekdays: [1,2,3,4,5] },

  // ── Monday-only ─────────────────────────────────────────────────────────────
  { path: "/api/cron/weekly-digest",    hours: [14], weekdays: [1] },
  { path: "/api/gusto/sync",            hours: [13], weekdays: [1] },
  { path: "/api/cron/generate-pdfs",    hours: [6],  weekdays: [1] },
  { path: "/api/cron/payroll-reminder", hours: [9],  dayOfMonth: 26 },

  // ── Monthly (specific day) ──────────────────────────────────────────────────
  { path: "/api/cron/refresh-linkedin",  hours: [9], dayOfMonth: 1 },
  { path: "/api/cron/linkedin-monitor",  hours: [9], dayOfMonth: 5 },
  { path: "/api/cron/sync-allowances",   hours: [9], dayOfMonth: 28 },

  // ── Every 4 hours ───────────────────────────────────────────────────────────
  { path: "/api/cron/ingest-meeting-notes", hours: [0,4,8,12,16,20] },

  // ── Daily safety-net mirror Notion → Supabase for crm_events.
  //    Restored 2026-05-08 after Phase A4 retirement left the events tab
  //    blank (0 rows in Supabase). UPSERT-only, so port-UI edits aren't
  //    clobbered. Retire once discovery feeds are live + the team works
  //    exclusively from the port UI for ≥4 weeks.
  { path: "/api/cron/sync-events-pilot", hours: [7] },

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
];

// sweep-stuck-proposals runs every 5 minutes — handled by the */5 trigger,
// NOT via CRON_TABLE (hourly router would under-fire it to once per hour).
const SWEEP_PATH = "/api/cron/sweep-stuck-proposals";

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
      }
    }).catch((err) => {
      console.error(`[scheduled] ${entry.path} fetch error:`, err);
    }),
  );
}

// ── Main scheduled handler ────────────────────────────────────────────────────

export async function scheduled(
  controller: ScheduledController,
  env: ScheduledEnv,
  ctx: ExecutionContext,
): Promise<void> {
  // sweep-stuck-proposals fires on its own */5 trigger — dispatch immediately
  // and return. The hourly router does not run sweep-stuck-proposals.
  if (controller.cron === "*/5 * * * *") {
    await dispatch({ path: SWEEP_PATH }, env, ctx);
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
