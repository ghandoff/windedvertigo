/**
 * GET /api/cron/pam-absence-horizon
 *
 * Daily. PaM pilot behavior #4 (charter: "an absence approaching (e.g.,
 * Jamie's August) → redistribution proposal two weeks out"). Reads the new
 * `time_off` table (SQL-seeded for phase 1 — no entry UI yet, see the
 * migration) against `pam_commitments` due dates falling inside the
 * absence window. PREVIEW tier: redistribution needs a human call on who
 * picks up the work, so this always goes through the approve/edit/redirect/
 * ignore card rather than auto-applying — targeted at Garrett, matching the
 * charter's "redistribution proposal ... + Garrett" pattern for overload/
 * absence cases.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { getPamCommitments } from "@/lib/supabase/pam";
import { insertIntervention } from "@/lib/supabase/agent-interventions";
import { buildInterventionBlocks, interventionFallbackText } from "@/lib/agent/intervention-card";
import { sendDmByEmail, postToChannelResilientDetailed } from "@/lib/slack";
import { ambientDirectDmsAllowed, ambientNotifyChannel } from "@/lib/agent/ambient-rollout";

const HORIZON_DAYS = 14;
const GARRETT_EMAIL = "garrett@windedvertigo.com";

interface TimeOffRow {
  id: string;
  owner_email: string;
  start_date: string;
  end_date: string;
  note: string | null;
}

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const horizonEnd = new Date(Date.now() + HORIZON_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("time_off")
    .select("*")
    .gte("start_date", today)
    .lte("start_date", horizonEnd);
  if (error) {
    console.warn("[cron/pam-absence-horizon] time_off query failed:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const upcoming = (data ?? []) as TimeOffRow[];

  const dmsAllowed = ambientDirectDmsAllowed();
  let proposalsRaised = 0;

  for (const absence of upcoming) {
    const who = absence.owner_email.split("@")[0].toLowerCase();
    const atRisk = (
      await getPamCommitments({ who, due_after: absence.start_date, due_before: absence.end_date })
    ).filter((c) => c.status !== "done");
    if (atRisk.length === 0) continue;

    const body =
      `${absence.owner_email} is out ${absence.start_date} → ${absence.end_date}` +
      `${absence.note ? ` (${absence.note})` : ""}. Commitments due in that window:\n` +
      atRisk.map((c) => `  • ${c.what} (due ${c.due_date})`).join("\n") +
      `\n\nredistribute or push these?`;

    const row = await insertIntervention({
      agent: "pam",
      decision: "preview",
      riskTier: "high",
      trigger: `absence approaching: ${absence.owner_email}, ${atRisk.length} commitment(s) at risk`,
      artifact: { title: `redistribution proposal — ${absence.owner_email}`, body },
      rationale: "charter: absence approaching → redistribution proposal two weeks out",
      targetHuman: GARRETT_EMAIL,
      // Deadline is the absence's own start date, not another 14 days out —
      // the redistribution call needs to land before the person is gone.
      expiresAt: new Date(`${absence.start_date}T00:00:00Z`).toISOString(),
    });
    if (!row) continue;

    const blocks = buildInterventionBlocks(row);
    const text = interventionFallbackText(row);
    if (dmsAllowed) {
      await sendDmByEmail(GARRETT_EMAIL, text, blocks);
    } else {
      await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${GARRETT_EMAIL}]\n${text}`, [], blocks);
    }
    proposalsRaised += 1;
  }

  return NextResponse.json({ absencesChecked: upcoming.length, proposalsRaised });
}
