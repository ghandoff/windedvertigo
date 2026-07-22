/**
 * The ONE RFP status-transition path.
 *
 * Both a manual board drag (PATCH /api/rfp-radar/[id]) and a Biz decision
 * (/api/biz/bid-decision) call this, so a drag and `biz_set_bid_decision`
 * persist identically and fire identical side-effects.
 *
 * Why it writes BOTH stores: the board reads Supabase, but the hourly
 * `sync-rfp-pilot` cron mirrors `status` FROM Notion INTO Supabase. Writing only
 * Supabase (the old Biz path) was reverted on the next sync — that was the
 * "cards revert to radar" bug. Writing Notion too keeps the mirror consistent.
 */

import { updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import type { RfpStatus } from "@/lib/notion/types";
import {
  setRfpStatus,
  getRfpOpportunityByIdFromSupabase,
} from "@/lib/supabase/rfp-opportunities";
import { createRfpDeadlineEvent } from "@/lib/gcal";
import { postToChannel } from "@/lib/slack";
import { syncWonRfpToDeal } from "@/lib/rfp/deal-sync";

export interface TransitionOpts {
  /** who triggered it — a session email, or "biz" for the agent path */
  triggeredBy?: string;
  /** Notion status was already written by the caller (PATCH writes all editable
   *  fields); skip the redundant Notion write here. */
  notionAlreadyWritten?: boolean;
}

/**
 * Move an opportunity to `status` durably (Supabase + Notion) and run the
 * status's side-effects. Moving to `pursuing` no longer auto-generates the full
 * proposal (R2) — the one-pager brief is the review glance, and the full draft
 * is triggered explicitly via the "generate full draft" button.
 */
export async function transitionRfpStatus(
  id: string,
  status: string,
  opts: TransitionOpts = {},
): Promise<void> {
  // 1. durable status write — BOTH stores
  await setRfpStatus(id, status); // Supabase (the read layer)
  if (!opts.notionAlreadyWritten) {
    await updateRfpOpportunity(id, { status: status as RfpStatus }); // Notion (sync source of truth)
  }

  // 1b. won → celebrate in #whirlpool + sync to a linked signed deal so the
  //     opportunity flows into the /strategy revenue pipeline (fire-and-forget).
  if (status === "won") {
    const opp = await getRfpOpportunityByIdFromSupabase(id).catch(() => null);
    const name = opp?.opportunityName;
    postToChannel(
      "#whirlpool",
      name
        ? `:tada: we won *${name}*! moving to won — great work team.`
        : `:tada: opportunity <https://port.windedvertigo.com/rfp-radar/${id}|${id}> just moved to *won*!`,
    ).catch(() => {});
    if (opp) {
      try {
        const r = await syncWonRfpToDeal(id, opp, opts.triggeredBy);
        console.log(`[transitionRfpStatus] deal ${r.action} for won RFP ${id}: ${r.dealKey}`);
      } catch (err) {
        console.warn("[transitionRfpStatus] syncWonRfpToDeal failed:", err);
      }
    }
  }

  // 2. pursuing → R2: do NOT auto-generate the full proposal draft. The one-pager
  //    brief (generated at intake) is the "glance" a human reviews; the full
  //    12k-token draft is triggered explicitly via the "generate full draft"
  //    button (POST /api/rfp-radar/[id]/regenerate-proposal). Removing the
  //    enqueue here stops unattended token spend on EVERY path that reaches
  //    pursuing — manual drag, the go/no-go cron's "bid" auto-advance, and the
  //    Biz agent — since they all funnel through this one function.
  if (status === "pursuing") {
    // still surface the deadline on the calendar — fire-and-forget
    const fresh = await getRfpOpportunityByIdFromSupabase(id).catch(() => null);
    if (fresh) createRfpDeadlineEvent(fresh).catch(() => {});
  }
}
