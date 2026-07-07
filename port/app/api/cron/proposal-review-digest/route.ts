/**
 * GET /api/cron/proposal-review-digest
 *
 * Daily Slack digest of proposal docs that need attention:
 *  - needs human review (stage = 'human-review')
 *  - needs biz review (stage = 'v1-generated', awaiting Biz to advance)
 *
 * Skips the Slack post if both lists are empty.
 * Auth: Bearer CRON_SECRET (standard pattern).
 * Runs daily at 09:00 UTC, weekdays (registered in lib/scheduled.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { postToChannel } from "@/lib/slack";

export const maxDuration = 30;

const CHANNEL = process.env.SLACK_RFP_CHANNEL ?? "#funding-opportunities";

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return !!auth && auth.replace("Bearer ", "") === process.env.CRON_SECRET;
}

function dueLine(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `${days}d`;
  return ` · ${date} (${label})`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error: queryErr } = await supabase
    .from("rfp_opportunities")
    .select(
      "notion_page_id, opportunity_name, due_date, proposal_review_stage, " +
      "proposal_draft_url, cover_letter_url, team_cvs_url",
    )
    .in("proposal_review_stage", ["v1-generated", "human-review"])
    // Exclude terminal bid statuses — a no-go or missed-deadline card that
    // previously had a proposal generated should not reappear every morning.
    .not("status", "in", '("no-go","missed deadline","lost","won")')
    .order("due_date", { ascending: true, nullsFirst: false });

  if (queryErr) {
    console.error("[proposal-review-digest] query failed:", queryErr);
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }

  type ReviewRow = {
    opportunity_name: string;
    due_date: string | null;
    proposal_review_stage: string;
    proposal_draft_url: string | null;
    cover_letter_url: string | null;
    team_cvs_url: string | null;
  };
  const rows = (data ?? []) as unknown as ReviewRow[];
  const humanReview = rows.filter((r) => r.proposal_review_stage === "human-review");
  const bizReview   = rows.filter((r) => r.proposal_review_stage === "v1-generated");

  if (humanReview.length === 0 && bizReview.length === 0) {
    return NextResponse.json({ posted: false, message: "nothing pending" });
  }

  const lines: string[] = ["*proposal review digest*"];

  if (humanReview.length) {
    lines.push(`\n📋 *needs your review (${humanReview.length})*`);
    for (const r of humanReview) {
      const name = r.opportunity_name;
      const due  = dueLine(r.due_date);
      const draftLink  = r.proposal_draft_url  ? `<${r.proposal_draft_url}|draft>` : "";
      const coverLink  = r.cover_letter_url     ? `<${r.cover_letter_url}|cover>` : "";
      const cvsLink    = r.team_cvs_url         ? `<${r.team_cvs_url}|cvs>` : "";
      const docLinks   = [draftLink, coverLink, cvsLink].filter(Boolean).join(" · ");
      lines.push(`  • ${name}${due}${docLinks ? `  ${docLinks}` : ""}`);
    }
  }

  if (bizReview.length) {
    lines.push(`\n🤖 *awaiting biz review (${bizReview.length})*`);
    for (const r of bizReview) {
      const name = r.opportunity_name;
      const due  = dueLine(r.due_date);
      lines.push(`  • ${name}${due}`);
    }
  }

  lines.push(`\n_open <https://port.windedvertigo.com/proposals|proposals> to approve or request revision_`);

  await postToChannel(CHANNEL, lines.join("\n")).catch((err) => {
    console.warn("[proposal-review-digest] Slack post failed (non-fatal):", err);
  });

  return NextResponse.json({
    posted: true,
    human_review: humanReview.length,
    biz_review: bizReview.length,
  });
}
