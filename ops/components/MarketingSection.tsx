'use client';

import type { ContentItem, CampaignMetrics, PipelineSummary } from '@/lib/types';

/* ────────────────────────────────────────────────────────────────
   MarketingSection — content calendar, campaign metrics, pipeline
   ──────────────────────────────────────────────────────────────── */

const CHANNEL_LABELS: Record<ContentItem['channel'], string> = {
  linkedin: 'li',
  bluesky: 'bsky',
  twitter: 'tw',
  newsletter: 'nl',
  blog: 'blog',
  website: 'web',
};

const CHANNEL_COLOURS: Record<ContentItem['channel'], string> = {
  linkedin: 'bg-blue-500/15 text-blue-300',
  bluesky: 'bg-sky-500/15 text-sky-300',
  twitter: 'bg-slate-500/15 text-slate-300',
  newsletter: 'bg-violet-500/15 text-violet-300',
  blog: 'bg-emerald-500/15 text-emerald-300',
  website: 'bg-teal-500/15 text-teal-300',
};

const STATUS_COLOURS: Record<ContentItem['status'], string> = {
  idea: 'text-ops-text-muted/50',
  draft: 'text-ops-text-muted',
  review: 'text-amber-400/80',
  approved: 'text-emerald-400/80',
  scheduled: 'text-blue-400/80',
  published: 'text-ops-text-muted/40',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function Pct({ value }: { value: number }) {
  const colour = value >= 30 ? 'text-emerald-400' : value >= 15 ? 'text-amber-400' : 'text-ops-text-muted';
  return <span className={`tabular-nums font-medium ${colour}`}>{value.toFixed(1)}%</span>;
}

// ── Content calendar widget ───────────────────────────────────

function ContentCalendarWidget({ items }: { items: ContentItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center text-[12px] text-ops-text-muted/50">
        <span className="mb-1">no content scheduled for the next 14 days</span>
        <span className="text-[10px]">cowork pushes items here once the cmo dispatch is active</span>
      </div>
    );
  }
  return (
    <div className="divide-y divide-ops-border/40">
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-2.5 py-2 px-1">
          <span className="mt-0.5 text-[10px] font-medium text-ops-text-muted/60 tabular-nums w-14 flex-shrink-0">
            {formatDate(item.scheduledDate)}
          </span>
          <span className={`mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${CHANNEL_COLOURS[item.channel]}`}>
            {CHANNEL_LABELS[item.channel]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-ops-text truncate">{item.title}</p>
            {item.author && (
              <p className="text-[10px] text-ops-text-muted/50 mt-0.5">{item.author}</p>
            )}
          </div>
          <span className={`text-[10px] flex-shrink-0 mt-0.5 ${STATUS_COLOURS[item.status]}`}>
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Campaign metrics widget ───────────────────────────────────

function CampaignMetricsWidget({ metrics }: { metrics: CampaignMetrics[] }) {
  if (metrics.length === 0) {
    return (
      <div className="text-[12px] text-ops-text-muted/50 py-4 text-center">
        no campaign data yet — cowork pushes metrics here weekly
      </div>
    );
  }
  return (
    <div className="divide-y divide-ops-border/40">
      {metrics.slice(0, 4).map(m => (
        <div key={m.campaignId} className="py-2 px-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-ops-text truncate flex-1 mr-2">{m.name}</span>
            <span className="text-[10px] text-ops-text-muted flex-shrink-0 tabular-nums">{m.emailsSent} sent</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-ops-text-muted/60">open</span>
            <Pct value={m.openRate} />
            <span className="text-ops-text-muted/60">click</span>
            <Pct value={m.clickRate} />
            <span className="text-ops-text-muted/60">reply</span>
            <Pct value={m.replyRate} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pipeline summary widget ───────────────────────────────────

const STAGE_ORDER = ['identified', 'pitched', 'proposal', 'won', 'lost'] as const;
type Stage = typeof STAGE_ORDER[number];
const STAGE_LABELS: Record<Stage, string> = {
  identified: 'identified',
  pitched: 'pitched',
  proposal: 'proposal',
  won: 'won',
  lost: 'lost',
};
const STAGE_COLOURS: Record<Stage, string> = {
  identified: 'bg-blue-500/20',
  pitched: 'bg-violet-500/20',
  proposal: 'bg-amber-500/20',
  won: 'bg-emerald-500/25',
  lost: 'bg-ops-border/40',
};

function PipelineWidget({ summary }: { summary: PipelineSummary }) {
  const total = summary.identified + summary.pitched + summary.proposal + summary.won + summary.lost;
  return (
    <div>
      {/* funnel bar */}
      {total > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden mb-3 gap-px">
          {STAGE_ORDER.map(stage => {
            const count = summary[stage];
            if (count === 0) return null;
            return (
              <div
                key={stage}
                className={STAGE_COLOURS[stage]}
                style={{ flex: count }}
              />
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-5 gap-1">
        {STAGE_ORDER.map(stage => (
          <div key={stage} className="flex flex-col items-center text-center">
            <span className={`text-[16px] font-semibold tabular-nums ${stage === 'won' ? 'text-emerald-400' : stage === 'lost' ? 'text-ops-text-muted/40' : 'text-ops-text'}`}>
              {summary[stage]}
            </span>
            <span className="text-[9px] text-ops-text-muted/60 uppercase tracking-wide">{STAGE_LABELS[stage]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

export interface MarketingSectionProps {
  contentCalendar: ContentItem[];
  campaignMetrics: CampaignMetrics[];
  pipelineSummary: PipelineSummary;
}

export function MarketingSection({ contentCalendar, campaignMetrics, pipelineSummary }: MarketingSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* content calendar */}
      <div className="lg:col-span-2 rounded-lg border border-ops-border p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ops-text-muted mb-3">
          content — next 14 days
        </p>
        <ContentCalendarWidget items={contentCalendar} />
      </div>

      {/* pipeline */}
      <div className="rounded-lg border border-ops-border p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ops-text-muted mb-3">
          pipeline
        </p>
        <PipelineWidget summary={pipelineSummary} />
        {campaignMetrics.length > 0 && (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ops-text-muted mt-4 mb-2">
              campaigns
            </p>
            <CampaignMetricsWidget metrics={campaignMetrics} />
          </>
        )}
      </div>

    </div>
  );
}
