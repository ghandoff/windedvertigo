/**
 * GET /api/cron/pam-action-triage
 *
 * Daily: takes meeting action items that have never been triaged for the PaM
 * board, runs the PaM triage LLM step over them (meaningful? cycle? type?
 * priority? duplicate of an existing commitment?), and writes the outcome:
 *   - meaningful  → triage_state='pending'   (lands in the PaM review inbox)
 *   - not         → triage_state='dismissed'
 *
 * Triage never creates commitments — a human accepts/merges/dismisses from the
 * inbox. This cron only populates the inbox.
 *
 * Auth: Bearer CRON_SECRET (scheduler) or CMO_API_TOKEN (on-demand agent run).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listUntriagedActions,
  setActionTriage,
} from "@/lib/supabase/meeting-action-items";
import { getPamCommitments } from "@/lib/supabase/pam";
import { triageActions, type TriageInputAction } from "@/lib/ai/pam-triage";
import { currentCycleMonday } from "@/lib/pam/cycle";

export const maxDuration = 300;

function verifyAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  return (
    (!!process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (!!process.env.CMO_API_TOKEN && token === process.env.CMO_API_TOKEN)
  );
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const actions = await listUntriagedActions(200);
  if (actions.length === 0) {
    return NextResponse.json({ ok: true, triaged: 0, message: "no untriaged actions" });
  }

  // Existing open commitments (exclude done/parked) for dedup, compacted.
  const commitments = await getPamCommitments({ limit: 300 }).catch(() => []);
  const existing = commitments
    .filter((c) => !["done", "parked"].includes(c.status))
    .map((c) => ({ id: c.id, who: c.who, what: c.what }));

  const input: TriageInputAction[] = actions.map((a) => ({
    id: a.id,
    title: a.title,
    owner: a.ownerEmail ?? a.ownerName,
    deadline: a.deadline,
    type: a.type,
    priority: a.priority,
    context: a.context,
  }));

  let pending = 0;
  let dismissed = 0;
  try {
    const { suggestions, usage } = await triageActions(
      input,
      existing,
      currentCycleMonday(),
      "pam-action-triage-cron",
    );

    for (const s of suggestions) {
      const state = s.meaningful ? "pending" : "dismissed";
      await setActionTriage(s.actionId, state, s);
      if (s.meaningful) pending++;
      else dismissed++;
    }

    console.log(
      "[cron/pam-action-triage]",
      JSON.stringify({ triaged: suggestions.length, pending, dismissed, costUsd: usage.costUsd }),
    );
    return NextResponse.json({ ok: true, triaged: suggestions.length, pending, dismissed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[cron/pam-action-triage] failed:", message);
    return NextResponse.json({ error: "triage_failed", message }, { status: 500 });
  }
}
