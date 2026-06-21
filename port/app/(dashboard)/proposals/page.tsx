/**
 * /proposals — proposal documents dashboard.
 *
 * Stage-grouped board showing all proposal docs that have been generated
 * (proposal_review_stage IS NOT NULL). Human review gates live here; Notion
 * pages remain the document bodies (links open in new tab).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { supabase } from "@/lib/supabase/client";
import { ProposalReviewActions } from "@/app/components/proposal-review-actions";

export const metadata: Metadata = { robots: "noindex" };
export const dynamic = "force-dynamic";

type Stage = "v1-generated" | "biz-review" | "human-review" | "approved" | "exported";

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

const STAGE_META: Record<Stage, { label: string; description: string; accent: string }> = {
  "v1-generated":  { label: "v1 — needs biz review", description: "auto-gen complete, awaiting Biz refinement", accent: "border-yellow-400/40 bg-yellow-400/5" },
  "biz-review":    { label: "biz review",             description: "Biz is refining; will notify when ready",    accent: "border-blue-400/40 bg-blue-400/5" },
  "human-review":  { label: "human review",           description: "waiting on your sign-off",                  accent: "border-orange-400/40 bg-orange-400/5" },
  "approved":      { label: "approved",               description: "all reviewers signed off",                  accent: "border-green-400/40 bg-green-400/5" },
  "exported":      { label: "exported",               description: "submitted / sent to InDesign",              accent: "border-muted/40 bg-muted/5" },
};

const STAGE_ORDER: Stage[] = ["v1-generated", "biz-review", "human-review", "approved", "exported"];

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function DueDateChip({ date }: { date: string }) {
  const days = daysUntil(date);
  const urgent = days <= 3;
  const overdue = days < 0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        overdue ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
        urgent  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                  "bg-muted text-muted-foreground"
      }`}
    >
      {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `${days}d`}
    </span>
  );
}

function FitBadge({ fit }: { fit: string | null }) {
  if (!fit || fit === "TBD") return null;
  const colour =
    fit === "high fit"   ? "text-green-600 dark:text-green-400" :
    fit === "medium fit" ? "text-yellow-600 dark:text-yellow-400" :
                           "text-muted-foreground";
  return <span className={`text-xs ${colour}`}>{fit}</span>;
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
    >
      {label}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

function ProposalCard({ row }: { row: ProposalRow }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <Link
          href={`/rfp-radar/${row.notion_page_id}`}
          className="text-sm font-medium leading-snug hover:underline"
        >
          {row.opportunity_name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {row.due_date && <DueDateChip date={row.due_date} />}
          <FitBadge fit={row.wv_fit_score} />
          {row.estimated_value !== null && (
            <span className="text-xs text-muted-foreground">{fmtUsd(row.estimated_value)}</span>
          )}
        </div>
      </div>

      {(row.proposal_draft_url || row.cover_letter_url || row.team_cvs_url) && (
        <div className="flex flex-wrap gap-3">
          {row.proposal_draft_url && <DocLink href={row.proposal_draft_url} label="proposal draft" />}
          {row.cover_letter_url   && <DocLink href={row.cover_letter_url}   label="cover letter" />}
          {row.team_cvs_url       && <DocLink href={row.team_cvs_url}       label="team cvs" />}
        </div>
      )}

      <ProposalReviewActions rfpId={row.notion_page_id} stage={row.proposal_review_stage} />
    </div>
  );
}

function StageColumn({ stage, rows }: { stage: Stage; rows: ProposalRow[] }) {
  const { label, description, accent } = STAGE_META[stage];
  return (
    <div className={`rounded-xl border-2 ${accent} p-4 space-y-3 min-w-0`}>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{label}</h2>
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">{rows.length}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 py-2">none</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <ProposalCard key={r.notion_page_id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ProposalsPage() {
  const { data, error: queryErr } = await supabase
    .from("rfp_opportunities")
    .select(
      "notion_page_id, opportunity_name, due_date, wv_fit_score, estimated_value, " +
      "proposal_review_stage, proposal_draft_url, cover_letter_url, team_cvs_url",
    )
    .not("proposal_review_stage", "is", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (queryErr) {
    return (
      <div className="p-6">
        <PageHeader title="proposals" />
        <p className="text-sm text-destructive mt-4">failed to load proposals: {queryErr.message}</p>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as ProposalRow[];

  const byStage: Record<Stage, ProposalRow[]> = {
    "v1-generated": [],
    "biz-review":   [],
    "human-review": [],
    "approved":     [],
    "exported":     [],
  };

  for (const r of rows) {
    if (r.proposal_review_stage && r.proposal_review_stage in byStage) {
      byStage[r.proposal_review_stage].push(r);
    }
  }

  const needsAttention = byStage["human-review"].length + byStage["v1-generated"].length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="proposals"
        description={
          needsAttention > 0
            ? `${needsAttention} doc${needsAttention !== 1 ? "s" : ""} need${needsAttention === 1 ? "s" : ""} attention`
            : `${rows.length} proposal doc${rows.length !== 1 ? "s" : ""} tracked`
        }
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          no proposals yet — generate one from an RFP{" "}
          <Link href="/opportunities" className="underline underline-offset-2">
            in the pipeline
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STAGE_ORDER.map((stage) => (
            <StageColumn key={stage} stage={stage} rows={byStage[stage]} />
          ))}
        </div>
      )}
    </div>
  );
}
