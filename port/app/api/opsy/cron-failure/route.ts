/**
 * POST /api/opsy/cron-failure — cron watchdog + the "re-run a failed cron"
 * auto-fix (docs/opsy/posture.md §2, safe-to-auto-fix list).
 *
 * Called by lib/scheduled.ts when a dispatched cron returns non-2xx or the
 * fetch throws. Body: { path, status?, error? }.
 *
 * Flow: record the failure (opsy_cron_runs) → retry the cron once → record
 * the auto-fix attempt (opsy_auto_fixes). If the retry succeeds, post a calm
 * note to #ops-alerts; if it fails too, open a warning incident (deduped per
 * cron path) which routes to slack via lib/opsy/alerts.ts.
 *
 * Auth: CRON_SECRET (the scheduler) or CMO_API_TOKEN (agents, manual).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import {
  getOpenAutoIncident,
  insertOpsyAutoFix,
  insertOpsyCronRun,
  insertOpsyIncident,
} from "@/lib/supabase/opsy";
import { notifyIncidentOpened, postOpsNote } from "@/lib/opsy/alerts";

export const maxDuration = 120;

const PORT_URL = process.env.PORT_URL ?? "https://port.windedvertigo.com";
const RETRY_TIMEOUT_MS = 60_000;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path : null;
  if (!path || !path.startsWith("/api/")) return error("path (an /api/* route) is required");
  // never retry ourselves — scheduled.ts also guards this, belt and braces
  if (path.startsWith("/api/opsy/cron-failure")) return error("refusing to recurse");

  const failureStatus = typeof body?.status === "number" ? body.status : null;
  const failureError = typeof body?.error === "string" ? body.error : null;

  try {
    // 1. retry once
    let retryOk = false;
    let retryStatus: number | null = null;
    let retryError: string | null = null;
    try {
      const res = await fetch(`${PORT_URL}${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(RETRY_TIMEOUT_MS),
      });
      retryStatus = res.status;
      retryOk = res.ok;
      await res.arrayBuffer().catch(() => undefined);
    } catch (err) {
      retryError = err instanceof Error ? err.message : "unknown fetch error";
    }

    // 2. record the failed run + retry outcome
    await insertOpsyCronRun({
      path,
      ok: false,
      status_code: failureStatus,
      error: failureError,
      retried: true,
      retry_ok: retryOk,
    });

    // 3. incident if the retry also failed (deduped per cron path)
    const service = `cron:${path.replace("/api/cron/", "").replace("/api/", "")}`;
    let incidentId: string | null = null;
    if (!retryOk) {
      const existing = await getOpenAutoIncident(service);
      if (existing) {
        incidentId = existing.id;
      } else {
        const symptoms = `${path} failed (${failureError ?? `HTTP ${failureStatus}`}) and the auto-retry also failed (${retryError ?? `HTTP ${retryStatus}`})`;
        const created = await insertOpsyIncident({
          service,
          severity: "warning",
          symptoms,
          metadata: { auto_created: true, path, status_code: retryStatus },
        });
        incidentId = created.id;
        await notifyIncidentOpened({
          id: created.id,
          service,
          severity: "warning",
          symptoms,
          opened_at: created.opened_at,
        });
      }
    }

    // 4. log the auto-fix attempt
    await insertOpsyAutoFix({
      incident_id: incidentId,
      action: `re-ran failed cron ${path}`,
      result: retryOk ? "success" : "failure",
      details: {
        original: { status: failureStatus, error: failureError },
        retry: { status: retryStatus, error: retryError },
      },
    });

    // 5. recovery note (posture voice: past tense + result)
    if (retryOk) {
      await postOpsNote(
        `:wrench: I re-ran the \`${path}\` cron after it failed (${failureError ?? `HTTP ${failureStatus}`}). the retry completed successfully.`,
      );
    }

    return json({ path, retried: true, retry_ok: retryOk, incident_id: incidentId });
  } catch (err) {
    console.error("[api/opsy/cron-failure] failed:", err);
    return error("cron-failure handling failed", 500);
  }
}
