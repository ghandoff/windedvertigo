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

const CRON_TABLE: CronEntry[] = [
  // ── Daily at fixed times ────────────────────────────────────────────────────
  // All fire at :00 of the designated hour (original minutes preserved as docs)
  { path: "/api/cron/rfp-gmail-scanner",    hours: [8] },
  { path: "/api/rfp-radar/poll-rss",        hours: [8],  originalMinute: 15 },
  { path: "/api/rfp-radar/poll-feedly",     hours: [8],  originalMinute: 30 },
  { path: "/api/cron/sync-replies",         hours: [8],  originalMinute: 55 },
  { path: "/api/cron/campaigns",            hours: [9],  originalMinute: 7 },
  { path: "/api/cron/sync-rfp-feeds-pilot", hours: [9] },
  { path: "/api/cron/relationship-alerts",  hours: [13] },
  { path: "/api/cron/deadline-reminders",   hours: [12] },

  // ── Inngest cron migrations ─────────────────────────────────────────────────
  // TODO G.2.3: create app/api/cron/submission-followup/route.ts +
  //             app/api/cron/bd-asset-health/route.ts from inngest function bodies
  { path: "/api/cron/submission-followup",  hours: [8] },
  { path: "/api/cron/bd-asset-health",      hours: [9],  weekdays: [1] },

  // ── Weekday-only ────────────────────────────────────────────────────────────
  { path: "/api/cron/meeting-briefings",    hours: [11], originalMinute: 30, weekdays: [1,2,3,4,5] },
  { path: "/api/cron/morning-digest",       hours: [9],  weekdays: [1,2,3,4,5] },
  { path: "/api/cron/sync-calendar-time",   hours: [14], weekdays: [1,2,3,4,5] },
  { path: "/api/cron/deadline-risk",        hours: [13], originalMinute: 30, weekdays: [1,2,3,4,5] },

  // ── Monday-only ─────────────────────────────────────────────────────────────
  { path: "/api/cron/weekly-digest",  hours: [14], weekdays: [1] },
  { path: "/api/gusto/sync",             hours: [13], weekdays: [1] },
  { path: "/api/cron/generate-pdfs",    hours: [6],  weekdays: [1] },
  { path: "/api/cron/payroll-reminder", hours: [9],  dayOfMonth: 26 },

  // ── Monthly (specific day) ──────────────────────────────────────────────────
  { path: "/api/cron/refresh-linkedin",      hours: [9], dayOfMonth: 1 },
  { path: "/api/cron/linkedin-monitor",      hours: [9], dayOfMonth: 5 },
  { path: "/api/cron/sync-allowances",       hours: [9], dayOfMonth: 28 },
  { path: "/api/cron/sync-allowances-pilot", hours: [9], dayOfMonth: 28 },

  // ── Every 2 hours ───────────────────────────────────────────────────────────
  { path: "/api/cron/sync-deals-pilot",         hours: [0,2,4,6,8,10,12,14,16,18,20,22] },
  { path: "/api/cron/sync-contacts-pilot",      hours: [0,2,4,6,8,10,12,14,16,18,20,22] },
  { path: "/api/cron/sync-organizations-pilot", hours: [0,2,4,6,8,10,12,14,16,18,20,22] },
  { path: "/api/cron/sync-work-items",          hours: [0,2,4,6,8,10,12,14,16,18,20,22] },
  { path: "/api/cron/sync-milestones-pilot",    hours: [0,2,4,6,8,10,12,14,16,18,20,22] },
  { path: "/api/cron/sync-projects-pilot",      hours: [0,2,4,6,8,10,12,14,16,18,20,22] },
  { path: "/api/cron/sync-cycles-pilot",        hours: [0,2,4,6,8,10,12,14,16,18,20,22] },

  // ── Every 4 hours ───────────────────────────────────────────────────────────
  { path: "/api/cron/ingest-meeting-notes",   hours: [0,4,8,12,16,20] },
  { path: "/api/cron/sync-activities-pilot",  hours: [0,4,8,12,16,20] },
  { path: "/api/cron/sync-social-pilot",      hours: [0,4,8,12,16,20] },
  { path: "/api/cron/sync-timesheets",        hours: [0,4,8,12,16,20] },

  // ── Every 6 hours ───────────────────────────────────────────────────────────
  { path: "/api/cron/sync-competitors-pilot", hours: [0,6,12,18] },

  // ── Fixed nightly (3am/4am/5am) ──────────────────────────────────────────────
  { path: "/api/cron/sync-events-pilot",     hours: [3] },
  { path: "/api/cron/sync-bd-assets-pilot",  hours: [4] },
  { path: "/api/cron/sync-blueprints-pilot", hours: [5] },

  // ── 2am daily seed ──────────────────────────────────────────────────────────
  { path: "/api/cron/sync-members-pilot",          hours: [2] },
  { path: "/api/cron/sync-email-templates-pilot",  hours: [2] },

  // ── Hourly ──────────────────────────────────────────────────────────────────
  { path: "/api/cron/sync-campaigns-pilot" },
  { path: "/api/cron/sync-campaign-steps-pilot" },
  { path: "/api/cron/sync-rfp-pilot" },
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
