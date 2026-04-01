'use client';

import { useState, useMemo } from 'react';

/* ────────────────────────────────────────────────────────────────
   InsightsPanel — plain-language analysis of operational data.
   the "so what?" layer that Notion can't do.
   ──────────────────────────────────────────────────────────────── */

export interface InsightsPanelProps {
  cash: number;
  monthlyBurn: number;
  monthlyRevenue: number;
  runway: number | null;
  projects: { name: string; status: 'green' | 'yellow' | 'red'; deadline?: string; owner?: string }[];
  tasks: { id: string; title: string; priority?: string; category: string }[];
  checkedTaskIds: Set<string>;
  deadlines: { title: string; date: string; project: string; priority: string }[];
  teamSize: number;
}

interface Insight {
  id: string;
  type: 'critical' | 'warning' | 'positive' | 'info';
  title: string;
  body: string;
  metric?: string;
  action?: string;
}

/* ── Severity ordering ────────────────────────────────────────── */

const SEVERITY_ORDER: Record<Insight['type'], number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  info: 3,
};

/* ── Style maps ───────────────────────────────────────────────── */

const BORDER_COLOR: Record<Insight['type'], string> = {
  critical: 'border-l-red-400',
  warning: 'border-l-amber-400',
  positive: 'border-l-emerald-400',
  info: 'border-l-blue-400',
};

const TITLE_COLOR: Record<Insight['type'], string> = {
  critical: 'text-red-400',
  warning: 'text-amber-400',
  positive: 'text-emerald-400',
  info: 'text-blue-400',
};

const BADGE_BG: Record<Insight['type'], string> = {
  critical: 'bg-red-400/15 text-red-400',
  warning: 'bg-amber-400/15 text-amber-400',
  positive: 'bg-emerald-400/15 text-emerald-400',
  info: 'bg-blue-400/15 text-blue-400',
};

/* ── Helpers ──────────────────────────────────────────────────── */

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

/* ── Insight derivation ───────────────────────────────────────── */

function deriveInsights(props: InsightsPanelProps): Insight[] {
  const {
    cash,
    monthlyBurn,
    monthlyRevenue,
    runway,
    projects,
    tasks,
    checkedTaskIds,
    deadlines,
    teamSize,
  } = props;

  const insights: Insight[] = [];

  // 1. Runway analysis
  if (runway !== null) {
    if (runway < 1) {
      const weeks = Math.max(Math.round(runway * 4.33), 0);
      insights.push({
        id: 'runway-critical',
        type: 'critical',
        title: 'cash runs out soon',
        body: `at current burn, cash lasts about ${weeks} week${weeks !== 1 ? 's' : ''}. this is the top priority.`,
        metric: `${weeks}w`,
        action: 'accelerate receivables, cut discretionary spend',
      });
    } else if (runway <= 3) {
      insights.push({
        id: 'runway-warning',
        type: 'warning',
        title: 'runway is getting tight',
        body: `at current burn, cash lasts ${runway.toFixed(1)} months. landing the next invoice would extend that.`,
        metric: `${runway.toFixed(1)} mo`,
        action: 'follow up on outstanding invoices',
      });
    } else if (runway > 6) {
      insights.push({
        id: 'runway-healthy',
        type: 'positive',
        title: 'healthy runway',
        body: `${runway.toFixed(1)} months of runway at current burn. breathing room to invest.`,
        metric: `${runway.toFixed(1)} mo`,
      });
    }
  }

  // 2. Burn trend
  if (monthlyRevenue === 0 && monthlyBurn > 0) {
    insights.push({
      id: 'burn-prerevenue',
      type: 'info',
      title: 'pre-revenue',
      body: `burn rate is ${fmt(monthlyBurn)}/mo against ${fmt(cash)} cash. every dollar out is investment.`,
      metric: `${fmt(monthlyBurn)}/mo`,
    });
  } else if (monthlyRevenue > 0 && monthlyBurn > monthlyRevenue * 2) {
    const ratio = (monthlyBurn / monthlyRevenue).toFixed(1);
    insights.push({
      id: 'burn-high',
      type: 'warning',
      title: 'burn outpacing revenue',
      body: `spending ${fmt(monthlyBurn)} for every ${fmt(monthlyRevenue)} earned. that's $${ratio} out per $1 in.`,
      metric: `${ratio}x`,
      action: 'review discretionary spend or accelerate pipeline',
    });
  }

  // 3. Project concentration risk
  const atRiskOrBlocked = projects.filter((p) => p.status === 'yellow' || p.status === 'red');
  const blockedProjects = projects.filter((p) => p.status === 'red');

  if (blockedProjects.length > 0) {
    const names = blockedProjects.map((p) => p.name).join(', ');
    insights.push({
      id: 'project-blocked',
      type: 'critical',
      title: `${blockedProjects.length === 1 ? blockedProjects[0].name : blockedProjects.length + ' projects'} blocked`,
      body: `${names} ${blockedProjects.length === 1 ? 'is' : 'are'} blocked. unblock before anything else moves.`,
      action: 'identify and clear the blocker',
    });
  }

  if (projects.length > 0 && atRiskOrBlocked.length / projects.length > 0.3 && blockedProjects.length === 0) {
    insights.push({
      id: 'project-concentration',
      type: 'warning',
      title: 'multiple projects need attention',
      body: `${atRiskOrBlocked.length} of ${projects.length} projects are at risk or blocked. spread might be too thin.`,
      metric: `${atRiskOrBlocked.length}/${projects.length}`,
    });
  }

  // 4. Deadline pressure
  for (const dl of deadlines) {
    const days = daysUntil(dl.date);
    if (days < 0) continue; // past deadlines skipped

    if (days <= 7) {
      insights.push({
        id: `deadline-critical-${dl.title}`,
        type: 'critical',
        title: `${dl.title} in ${days} day${days !== 1 ? 's' : ''}`,
        body: `this is the week for ${dl.title} (${dl.project}). everything else is secondary.`,
        metric: `${days}d`,
      });
    } else if (days <= 14) {
      insights.push({
        id: `deadline-warning-${dl.title}`,
        type: 'warning',
        title: `${dl.title} in ${days} days`,
        body: `${dl.title} (${dl.project}) is ${days} days out. make sure the team has what they need.`,
        metric: `${days}d`,
        action: 'confirm deliverables are on track',
      });
    }
  }

  // 5. Task completion rate
  const totalTasks = tasks.length;
  if (totalTasks > 0) {
    const checkedCount = tasks.filter((t) => checkedTaskIds.has(t.id)).length;
    const rate = checkedCount / totalTasks;

    if (rate > 0.75) {
      insights.push({
        id: 'tasks-strong',
        type: 'positive',
        title: 'strong execution',
        body: `${checkedCount} of ${totalTasks} tasks complete. momentum is good.`,
        metric: `${checkedCount}/${totalTasks}`,
      });
    } else if (rate < 0.25) {
      const openCount = totalTasks - checkedCount;
      insights.push({
        id: 'tasks-behind',
        type: 'warning',
        title: 'most tasks still open',
        body: `${openCount} of ${totalTasks} action items untouched. might need to reprioritize.`,
        metric: `${openCount} open`,
        action: 'pick the top 3 and focus there',
      });
    }
  }

  // 6. Team load
  if (teamSize > 0 && tasks.length > 0) {
    const openTasks = tasks.filter((t) => !checkedTaskIds.has(t.id)).length;
    const perPerson = openTasks / teamSize;
    if (perPerson > 3) {
      insights.push({
        id: 'team-load',
        type: 'info',
        title: 'team is loaded',
        body: `~${perPerson.toFixed(1)} open tasks per team member. consider trimming the backlog.`,
        metric: `${perPerson.toFixed(1)}/person`,
        action: 'prioritize ruthlessly or defer low-impact items',
      });
    }
  }

  // 7. Revenue opportunity
  if (monthlyRevenue === 0) {
    const greenProjects = projects.filter((p) => p.status === 'green');
    if (greenProjects.length > 0) {
      insights.push({
        id: 'revenue-opportunity',
        type: 'info',
        title: 'active projects, no revenue yet',
        body: `${greenProjects.length} project${greenProjects.length !== 1 ? 's' : ''} on track but no revenue booked. first invoice is the priority.`,
        metric: `${greenProjects.length} active`,
        action: 'identify the closest project to invoicing and push it across the line',
      });
    }
  }

  // Sort by severity
  insights.sort((a, b) => SEVERITY_ORDER[a.type] - SEVERITY_ORDER[b.type]);

  return insights;
}

/* ── Component ────────────────────────────────────────────────── */

const MAX_VISIBLE = 5;

export function InsightsPanel(props: InsightsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const insights = useMemo(() => deriveInsights(props), [props]);

  if (insights.length === 0) return null;

  const visible = showAll ? insights : insights.slice(0, MAX_VISIBLE);
  const hasMore = insights.length > MAX_VISIBLE;

  return (
    <section aria-label="Operational insights">
      <h3 className="text-[10px] uppercase tracking-widest text-ops-text-muted mb-3">
        Insights
      </h3>

      <div className="flex flex-col gap-2">
        {visible.map((insight) => (
          <div
            key={insight.id}
            className={[
              'border-l-[3px] rounded-r bg-ops-card/60 px-3 py-2.5',
              BORDER_COLOR[insight.type],
            ].join(' ')}
          >
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className={`text-[13px] font-medium ${TITLE_COLOR[insight.type]}`}>
                {insight.title}
              </span>
              {insight.metric && (
                <span
                  className={`text-[11px] font-bold tabular-nums rounded px-1.5 py-0.5 ${BADGE_BG[insight.type]}`}
                >
                  {insight.metric}
                </span>
              )}
            </div>

            {/* Body */}
            <p className="text-[12px] text-ops-text leading-relaxed mt-1">
              {insight.body}
            </p>

            {/* Action */}
            {insight.action && (
              <p className="text-[11px] text-ops-text-muted italic mt-1">
                <span aria-hidden="true">&rarr; </span>
                {insight.action}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Show all toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-2 text-[11px] text-ops-text-muted hover:text-ops-text transition-colors"
        >
          {showAll ? 'show less' : `show all (${insights.length})`}
        </button>
      )}
    </section>
  );
}
