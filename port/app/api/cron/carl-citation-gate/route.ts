/**
 * GET /api/cron/carl-citation-gate
 *
 * Daily. cARL's first spine-integrated behavior — its charter citation gate:
 * review content queued to publish (compose_drafts) for claim-boundary /
 * citation problems against cARL's findings evidence base, and flag concerns.
 *
 * For each active draft not yet reviewed (dedup by draftId against recent cARL
 * interventions), Claude (Haiku, `citation-matching`) returns a verdict
 * (lib/carl/citation-check). Concerns → a LOW-tier notify card to Garrett with
 * the specific flags + suggested sources (charter: "comment anywhere (LOW)").
 * "ok" verdicts insert a SILENT row (logged, never posted) purely so the next
 * run doesn't re-run Claude on an already-cleared draft.
 *
 * Budget-gated (≤3/agent/day). cARL is deliberately NOT in Opsy's
 * ACTIVE_AMBIENT_AGENTS quiet-list — a silent week (no drafts to review, or
 * all clean) is correct, not a fault.
 */

import { NextRequest, NextResponse } from "next/server";
import { listComposeDrafts, type ComposeDraft } from "@/lib/supabase/compose-drafts";
import { getCarlFindings } from "@/lib/supabase/carl";
import {
  insertIntervention,
  listRecentByAgent,
  setInterventionStatus,
} from "@/lib/supabase/agent-interventions";
import { NotificationBudget } from "@/lib/agent/intervention-budget";
import { checkDraftCitations } from "@/lib/carl/citation-check";
import { sendDmByEmail, postToChannelResilientDetailed } from "@/lib/slack";
import { ambientDirectDmsAllowed, ambientNotifyChannel } from "@/lib/agent/ambient-rollout";

const MAX_REVIEW_PER_RUN = 4;
const EVIDENCE_FINDINGS = 40;
const GARRETT_EMAIL = "garrett@windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

function reviewedDraftIds(recent: Awaited<ReturnType<typeof listRecentByAgent>>): Set<string> {
  const ids = new Set<string>();
  for (const row of recent) {
    const action = row.artifact?.executeAction as { type?: string; draftId?: string } | undefined;
    if (action?.type === "carl_citation_review" && action.draftId) ids.add(action.draftId);
  }
  return ids;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // "Queued to publish" = unpublished drafts + scheduled ones.
  const [drafts, scheduled, recentCarl] = await Promise.all([
    listComposeDrafts({ status: "draft", limit: 100 }),
    listComposeDrafts({ status: "scheduled", limit: 100 }),
    listRecentByAgent("carl", 7),
  ]);
  const reviewed = reviewedDraftIds(recentCarl);
  const queue: ComposeDraft[] = [...drafts, ...scheduled]
    .filter((d) => d.contentText && !reviewed.has(d.id))
    .slice(0, MAX_REVIEW_PER_RUN);

  if (queue.length === 0) {
    return NextResponse.json({ reviewed: 0, concerns: 0, posted: 0 });
  }

  const findings = await getCarlFindings({ limit: EVIDENCE_FINDINGS });
  const evidence = findings.map((f) => ({ title: f.title, summary: f.summary }));

  const budget = await NotificationBudget.load("carl");
  const dmsAllowed = ambientDirectDmsAllowed();
  let concerns = 0;
  let posted = 0;
  let cleared = 0;

  for (const draft of queue) {
    const verdict = await checkDraftCitations({ title: draft.title, contentText: draft.contentText }, evidence);
    if (!verdict) continue; // extraction failed — leave undedup'd so a later run retries

    const dedupAction = { type: "carl_citation_review", draftId: draft.id };

    if (verdict.verdict === "ok") {
      // Clean — log a silent row so we don't re-review it, no ping.
      await insertIntervention({
        agent: "carl",
        decision: "silent",
        riskTier: "low",
        trigger: `citation gate: draft "${draft.title ?? draft.id}" reviewed — no concerns`,
        artifact: { title: draft.title ?? "draft", body: verdict.summary, executeAction: dedupAction },
        rationale: "charter: citation gate — clean draft, logged for dedup",
      });
      cleared += 1;
      continue;
    }

    // Concerns → surface a LOW-tier flag to Garrett.
    concerns += 1;
    const flagLines = verdict.flags.map((f) => `  • ${f}`).join("\n");
    const sources = verdict.suggestedSources.length
      ? `\n\n_relevant findings:_ ${verdict.suggestedSources.join("; ")}`
      : "";
    const body =
      `🔬 *cARL — citation concerns on a draft queued to publish*\n` +
      `*${draft.title ?? "(untitled)"}* — ${verdict.summary}\n\n${flagLines}${sources}\n\n` +
      `_review at port.windedvertigo.com/compose before publishing._`;

    const overBudget = await budget.wouldExceed(GARRETT_EMAIL);
    const row = await insertIntervention({
      agent: "carl",
      decision: "act_notify",
      riskTier: "low",
      trigger: `citation gate: draft "${draft.title ?? draft.id}" has claim-boundary/citation concerns`,
      artifact: { title: `citation concerns — ${draft.title ?? "draft"}`, body, executeAction: dedupAction },
      rationale: "charter: citation gate / falsification duty — flag unsupported or overreaching claims",
      targetHuman: GARRETT_EMAIL,
    });
    if (!row) continue;
    budget.record(GARRETT_EMAIL);
    if (overBudget) continue; // logged in /inbox, no ping

    if (dmsAllowed) {
      posted += (await sendDmByEmail(GARRETT_EMAIL, body)) ? 1 : 0;
    } else {
      posted += (await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${GARRETT_EMAIL}]\n${body}`)).posted ? 1 : 0;
    }
    await setInterventionStatus(row.id, "executed");
  }

  return NextResponse.json({ reviewed: queue.length, cleared, concerns, posted });
}
