/**
 * /proposals — proposal documents tracker.
 *
 * Grouped-table layout: active proposals grouped by lifecycle stage,
 * plus a "declined / no-go" section sourced from bid_decision = 'no-bid'.
 * "needs attention" is sorted soonest-deadline-first so priorities are obvious.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { supabase } from "@/lib/supabase/client";
import { ProposalReviewActions } from "@/app/components/proposal-review-actions";

export const metadata: Metadata = { robots: "noindex" };
export const dynamic = "force-dynamic";

type Stage =
  | "v1-generated"
  | "biz-review"
  | "human-review"
  | "approved"
  | "exported"
  | "submitted";

interface ProposalRow {
  notion_page_id: string;
  opportunity_name: string;
  due_date: string | null;
  wv_fit_score: string | null;
  estimated_value: number | null;
  proposal_review_stage: Stage;
  proposal_draft_url: string | null;
  cover_letter_url: string | null;
  team_cvs_url: string | null;
}

interface NoGoRow {
  notion_page_id: string;
  opportunity_name: string;
  due_date: string | null;
  wv_fit_score: string | null;
  estimated_value: number | null;
  bid_decision_reason: string | null;
  bid_decision_score: number | null;
}

// ── stage presentation ────────────────────────────────────────────────────────

const STAGE_LABEL: Record<Stage, string> = {
  "v1-generated": "v1 — needs biz",
  "biz-review":   "biz review",
  "human-review": "needs your review",
  "approved":     "approved",
  "exported":     "exported",
  "submitted":    "submitted",
};

const STAGE_COLOUR: Record<Stage, string> = {
  "v1-generated": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "biz-review":   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "human-review": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "approved":     "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "exported":     "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "submitted":    "bg-muted text-muted-foreground",
};

// ── grouping ──────────────────────────────────────────────────────────────────

type GroupKey = "attention" | "progress" | "complete";

const STAGE_GROUP: Record<Stage, GroupKey> = {
  "v1-generated": "attention",
  "human-review": "attention",
  "biz-review":   "progress",
  "approved":     "progress",
  "exported":     "complete",
  "submitted":    "complete",
};

const GROUP_META: Record<GroupKey, { label: string; emptyNote: string }> = {
  attention: { label: "needs attention",  emptyNote: "nothing waiting on you" },
  progress:  { label: "in progress",      emptyNote: "nothing in flight" },
  complete:  { label: "exported / submitted", emptyNote: "nothing here yet" },
};

const GROUP_ORDER: GroupKey[] = ["attention", "progress", "complete"];

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function DueDateChip({ date }: { date: string }) {
  const d = daysUntil(date);
  const cls =
    d < 0  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
    d <= 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
             "bg-muted text-muted-foreground";
  const label = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "today" : `${d}d`;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${cls}`}>
      {date.slice(0, 10).replace(/-/g, "/")} · {label}
    </span>
  );
}

function StagePill({ stage }: { stage: Stage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STAGE_COLOUR[stage]}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

function FitCell({ score }: { score: string | null }) {
  if (!score || score === "TBD") return <span className="text-xs text-muted-foreground/40">—</span>;
  const cls =
    score === "high fit"   ? "text-green-600 dark:text-green-400" :
    score === "medium fit" ? "text-yellow-600 dark:text-yellow-400" :
    "text-muted-foreground";
  return <span className={`text-xs ${cls}`}>{score.replace(" fit", "")}</span>;
}

function DocLinks({ draft, cover, cvs }: { draft: string | null; cover: string | null; cvs: string | null }) {
  const links = [
    { href: draft, label: "draft" },
    { href: cover, label: "cover" },
    { href: cvs,   label: "cvs" },
  ].filter((l): l is { href: string; label: string } => !!l.href);

  if (links.length === 0) return <span className="text-xs text-muted-foreground/40">—</span>;

  return (
    <span className="flex flex-wrap gap-2">
      {links.map(({ href, label }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
        >
          {label}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ))}
    </span>
  );
}

// ── active-proposals table ────────────────────────────────────────────────────

function ProposalTable({ rows, group }: { rows: ProposalRow[]; group: GroupKey }) {
  const { label, emptyNote } = GROUP_META[group];

  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 py-2 pl-1">{emptyNote}</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[32%]">proposal</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[16%]">deadline</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[10%]">fit</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[9%]">value</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[14%]">stage</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[10%]">docs</th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground w-[9%]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.notion_page_id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-3">
                    <Link
                      href={`/rfp-radar/${r.notion_page_id}`}
                      className="font-medium leading-snug hover:underline underline-offset-2 line-clamp-2"
                    >
                      {r.opportunity_name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3">
                    {r.due_date ? <DueDateChip date={r.due_date} /> : <span className="text-xs text-muted-foreground/40">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <FitCell score={r.wv_fit_score} />
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">
                    {r.estimated_value !== null
                      ? <span className="text-xs text-muted-foreground">{fmtUsd(r.estimated_value)}</span>
                      : <span className="text-xs text-muted-foreground/40">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <StagePill stage={r.proposal_review_stage} />
                  </td>
                  <td className="py-2.5 px-3">
                    <DocLinks
                      draft={r.proposal_draft_url}
                      cover={r.cover_letter_url}
                      cvs={r.team_cvs_url}
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <ProposalReviewActions
                      rfpId={r.notion_page_id}
                      stage={r.proposal_review_stage}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── declined / no-go table ────────────────────────────────────────────────────

function NoGoTable({ rows }: { rows: NoGoRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">declined / no-go</h2>
        <span className="text-xs text-muted-foreground/60">{rows.length}</span>
      </div>
      <div className="rounded-lg border border-border overflow-hidden opacity-70">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[38%]">opportunity</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[16%]">deadline</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[10%]">fit</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-[9%]">value</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.notion_page_id} className="hover:bg-muted/10 transition-colors">
                <td className="py-2.5 px-3">
                  <Link
                    href={`/rfp-radar/${r.notion_page_id}`}
                    className="leading-snug hover:underline underline-offset-2 line-clamp-2 text-muted-foreground"
                  >
                    {r.opportunity_name}
                  </Link>
                </td>
                <td className="py-2.5 px-3">
                  {r.due_date ? <DueDateChip date={r.due_date} /> : <span className="text-xs text-muted-foreground/40">—</span>}
                </td>
                <td className="py-2.5 px-3">
                  <FitCell score={r.wv_fit_score} />
                </td>
                <td className="py-2.5 px-3 tabular-nums">
                  {r.estimated_value !== null
                    ? <span className="text-xs text-muted-foreground">{fmtUsd(r.estimated_value)}</span>
                    : <span className="text-xs text-muted-foreground/40">—</span>}
                </td>
                <td className="py-2.5 px-3">
                  {r.bid_decision_reason
                    ? <span className="text-xs text-muted-foreground italic">{r.bid_decision_reason}</span>
                    : <span className="text-xs text-muted-foreground/40">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function ProposalsPage() {
  // Run both queries in parallel — independent round-trips, no need to sequence them
  const [activeResult, noGoResult] = await Promise.all([
    supabase
      .from("rfp_opportunities")
      .select(
        "notion_page_id, opportunity_name, due_date, wv_fit_score, estimated_value, " +
        "proposal_review_stage, proposal_draft_url, cover_letter_url, team_cvs_url",
      )
      .not("proposal_review_stage", "is", null)
      .order("due_date", { ascending: true, nullsFirst: false }),

    supabase
      .from("rfp_opportunities")
      .select(
        "notion_page_id, opportunity_name, due_date, wv_fit_score, estimated_value, " +
        "bid_decision_reason, bid_decision_score",
      )
      .eq("bid_decision", "no-bid")
      .order("due_date", { ascending: false, nullsFirst: false }),
  ]);

  if (activeResult.error) {
    return (
      <div className="p-6">
        <PageHeader title="proposals" />
        <p className="text-sm text-destructive mt-4">failed to load: {activeResult.error.message}</p>
      </div>
    );
  }

  const rows = (activeResult.data ?? []) as unknown as ProposalRow[];
  const noGoRows = (noGoResult.data ?? []) as unknown as NoGoRow[];

  const byGroup: Record<GroupKey, ProposalRow[]> = {
    attention: [],
    progress:  [],
    complete:  [],
  };

  for (const r of rows) {
    if (r.proposal_review_stage) {
      byGroup[STAGE_GROUP[r.proposal_review_stage]].push(r);
    }
  }

  // Sort "needs attention" by closest deadline first — overdue items (negative days)
  // sort before upcoming ones, and null due_dates fall to the bottom.
  byGroup.attention.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const needsAttention = byGroup.attention.length;
  const totalActive = rows.length;

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="proposals"
        description={
          needsAttention > 0
            ? `${needsAttention} doc${needsAttention !== 1 ? "s" : ""} need${needsAttention === 1 ? "s" : ""} attention · ${totalActive} active · ${noGoRows.length} declined`
            : `${totalActive} active · ${noGoRows.length} declined`
        }
      />

      {totalActive === 0 && noGoRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          no proposals yet — generate one from an RFP{" "}
          <Link href="/opportunities" className="underline underline-offset-2">
            in the pipeline
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-8">
          {GROUP_ORDER.map((g) => (
            <ProposalTable key={g} group={g} rows={byGroup[g]} />
          ))}
          <NoGoTable rows={noGoRows} />
        </div>
      )}
    </div>
  );
}
