'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { signOutAction } from '@/app/actions';
import type {
  Project,
  TeamMember,
  Meeting,
  Deadline,
  Task,
  DispatchTask,
  FinancialMetric,
} from '@/lib/types';
import Sparkline from './Sparkline';
import { StatusBadge, projectStatusToBadge } from './StatusBadge';
import { DetailDrawer, DrawerSection, DrawerField } from './DetailDrawer';
import { CommandPalette } from './CommandPalette';
import type { CommandItem } from './CommandPalette';
import { StalenessBar } from './StalenessBar';

/* ────────────────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────────────────── */

interface DashboardShellProps {
  data: {
    projects: Project[];
    teamMembers: TeamMember[];
    upcomingMeetings: Meeting[];
    deadlines: Deadline[];
    tasks: Task[];
    dispatchTasks: DispatchTask[];
    financialMetrics: FinancialMetric[];
  };
  user: { email: string; firstName: string };
  date: string;
  dataAsOf: string;
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STORAGE_KEY = 'ops-checked-tasks';

function loadChecked(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveChecked(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

/** Parse a financial metric value string into a number */
function parseMetricValue(val?: string | number): number {
  if (val === undefined || val === null) return 0;
  return parseFloat(String(val).replace(/[,$]/g, ''));
}

/* ────────────────────────────────────────────────────────────────
   Inline sub-components
   ──────────────────────────────────────────────────────────────── */

function ChevronIcon({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-90' : ''} ${className}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Section({ title, defaultOpen = true, badge, children }: {
  title: string; defaultOpen?: boolean; badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6 last:mb-0">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left group cursor-pointer mb-3">
        <ChevronIcon open={open} className="text-ops-text-muted group-hover:text-ops-text" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ops-text-muted group-hover:text-ops-text transition-colors">
          {title}
        </span>
        {badge}
      </button>
      {open && children}
    </div>
  );
}

function TaskRow({ task, checked, onToggle, priority }: {
  task: Task; checked: boolean; onToggle: (id: string) => void; priority?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2.5 px-1 py-2 rounded group ${checked ? 'opacity-35' : ''}`}>
      <button
        onClick={() => onToggle(task.id)}
        className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${
          checked
            ? 'bg-ops-border border border-ops-border'
            : priority
            ? 'border-2 border-amber-500/40 hover:border-amber-400'
            : 'border border-ops-border hover:border-ops-text-muted'
        }`}
      >
        {checked && <CheckIcon />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug ${checked ? 'line-through text-ops-text-muted' : 'text-ops-text'}`}>
          {task.title}
        </p>
        {!checked && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {task.assigned && <span className="text-[10px] text-ops-text-muted">{task.assigned}</span>}
            {task.assigned && task.category && <span className="text-[10px] text-ops-text-muted/40">·</span>}
            <span className="text-[10px] text-ops-text-muted/60">{task.category}</span>
          </div>
        )}
        {!checked && task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {task.subtasks.map((st, j) => (
              <p key={j} className="text-[11px] text-ops-text-muted/70 pl-2 border-l border-ops-border/50">{st}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Dashboard
   ──────────────────────────────────────────────────────────────── */

export function DashboardShell({ data, user, date, dataAsOf }: DashboardShellProps) {
  const [mounted, setMounted] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [drawerProject, setDrawerProject] = useState<Project | null>(null);
  const [drawerMeeting, setDrawerMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    setMounted(true);
    setChecked(loadChecked());
  }, []);

  const toggleTask = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveChecked(next);
      return next;
    });
  }, []);

  const { projects, teamMembers, upcomingMeetings, deadlines, tasks, dispatchTasks, financialMetrics } = data;

  // ── command palette items (hook must be before early return) ──
  const commandItems: CommandItem[] = useMemo(() => [
    ...projects.map(p => ({
      id: `project-${p.id}`,
      label: p.name,
      category: 'Projects',
      href: `#project-${p.id}`,
    })),
    ...tasks.map(t => ({
      id: `task-${t.id}`,
      label: t.title,
      category: 'Tasks',
    })),
    ...upcomingMeetings.map(m => ({
      id: `meeting-${m.id}`,
      label: m.title,
      category: 'This Week',
    })),
    { id: 'nav-finance', label: 'Financial Overview', category: 'Navigation', shortcut: '↑' },
    { id: 'nav-projects', label: 'Projects', category: 'Navigation' },
    { id: 'nav-tasks', label: 'Action Items', category: 'Navigation' },
    { id: 'nav-signout', label: 'Sign Out', category: 'Actions' },
  ], [projects, tasks, upcomingMeetings]);

  const handleCommandSelect = useCallback((item: CommandItem) => {
    if (item.id === 'nav-signout') {
      document.querySelector<HTMLFormElement>('form[action]')?.requestSubmit();
      return;
    }
    if (item.id.startsWith('project-')) {
      const p = projects.find(pr => `project-${pr.id}` === item.id);
      if (p) setDrawerProject(p);
      return;
    }
    if (item.id.startsWith('meeting-')) {
      const m = upcomingMeetings.find(mt => `meeting-${mt.id}` === item.id);
      if (m) setDrawerMeeting(m);
      return;
    }
    if (item.href) {
      document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [projects, upcomingMeetings]);

  // ── early return AFTER all hooks ─────────────────────────────
  if (!mounted) return null;

  // ── derived data ─────────────────────────────────────────────
  const cashMetric = financialMetrics.find(m => m.label === 'Cash Position');
  const burnMetric = financialMetrics.find(m => m.label === 'Monthly Burn');
  const ytdExpenses = financialMetrics.find(m => m.label === 'YTD Expenses');
  const ytdRevenue = financialMetrics.find(m => m.label === 'YTD Revenue');

  const cash = parseMetricValue(cashMetric?.value);
  const burn = parseMetricValue(burnMetric?.value);
  const runway = burn > 0 ? Math.round((cash / burn) * 10) / 10 : null;
  const runwayPct = runway !== null ? Math.min(runway / 6, 1) : 0;

  // Sparkline data — would come from KV history in the future; use synthetic for now
  const cashHistory = [2800, 2600, 2400, 2200, 2100, cash];
  const burnHistory = [3800, 4000, 4100, 4200, 4275, burn];

  const cashTrend = cash >= cashHistory[cashHistory.length - 2] ? '#34d399' : '#f87171';
  const burnTrend = burn <= burnHistory[burnHistory.length - 2] ? '#34d399' : '#f87171';

  const highPriorityDeadlines = deadlines.filter(d => d.priority === 'high');
  const activeTasks = tasks.filter(t => !checked.has(t.id));
  const doneTasks = tasks.filter(t => checked.has(t.id));
  const highTasks = activeTasks.filter(t => t.priority === 'high');
  const otherTasks = activeTasks.filter(t => t.priority !== 'high');

  const blockedProjects = projects.filter(p => p.status === 'red');
  const warningProjects = projects.filter(p => p.status === 'yellow');

  // ── alerts ───────────────────────────────────────────────────
  const alerts: { level: 'critical' | 'warn'; text: string; detail?: string }[] = [];
  if (runway !== null && runway < 1) {
    alerts.push({ level: 'critical', text: `${runway} months runway`, detail: 'Revenue needs to land — monitor daily' });
  } else if (runway !== null && runway < 3) {
    alerts.push({ level: 'warn', text: `${runway} months runway`, detail: 'Monitor cash position closely' });
  }
  highPriorityDeadlines.forEach(d => {
    const days = daysUntil(d.date);
    if (days <= 14) {
      alerts.push({
        level: days <= 7 ? 'critical' : 'warn',
        text: `${d.title} due in ${days} days`,
        detail: `${new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${d.project}`,
      });
    }
  });
  blockedProjects.forEach(p => alerts.push({ level: 'critical', text: `${p.name} is blocked` }));

  // ── active drawer ────────────────────────────────────────────
  const drawerOpen = drawerProject !== null || drawerMeeting !== null;
  const closeDrawer = () => { setDrawerProject(null); setDrawerMeeting(null); };

  return (
    <div className="min-h-screen flex flex-col bg-ops-bg text-ops-text">

      {/* ── command palette (always mounted for keyboard listener) ── */}
      <CommandPalette items={commandItems} onSelect={handleCommandSelect} />

      {/* ── header ───────────────────────────────────────────── */}
      <header className="border-b border-ops-border/60 sticky top-0 bg-ops-bg/90 backdrop-blur-md z-50">
        <div className="max-w-6xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-ops-heading lowercase tracking-tight">
              winded.vertigo <span className="text-ops-text-muted font-normal ml-1">ops</span>
            </span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-ops-border/40 text-[9px] text-ops-text-muted font-mono">
              ⌘K
            </kbd>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-ops-text-muted">
            <span className="hidden sm:inline">{user.email}</span>
            <span>{date}</span>
            <form action={signOutAction}>
              <button type="submit" className="hover:text-ops-text transition-colors cursor-pointer">sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-5 py-6 flex-1">

        {/* ── financial strip with sparklines ─────────────────── */}
        <div className="rounded-xl border border-ops-border bg-ops-card p-5 mb-6">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mb-4">
            {/* Cash — hero number + sparkline */}
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ops-text-muted mb-0.5">cash</p>
                <p className="text-3xl font-bold text-ops-heading tabular-nums leading-none">${cash.toLocaleString()}</p>
              </div>
              <Sparkline data={cashHistory} color={cashTrend} width={72} height={24} />
            </div>
            {/* Burn + sparkline */}
            <div className="flex items-end gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ops-text-muted mb-0.5">monthly burn</p>
                <p className="text-lg font-semibold text-ops-text tabular-nums leading-none">${burn.toLocaleString()}</p>
              </div>
              <Sparkline data={burnHistory} color={burnTrend} width={56} height={18} />
            </div>
            {/* Runway */}
            {runway !== null && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ops-text-muted mb-0.5">runway</p>
                <p className={`text-lg font-semibold tabular-nums leading-none ${
                  runway < 1 ? 'text-red-400' : runway < 3 ? 'text-amber-400' : 'text-emerald-400'
                }`}>{runway} mo</p>
              </div>
            )}
            {/* Separator */}
            <div className="hidden sm:block w-px h-8 bg-ops-border mx-1" />
            {/* YTD */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-ops-text-muted mb-0.5">ytd revenue</p>
              <p className="text-sm text-ops-text tabular-nums leading-none">
                ${ytdRevenue?.hasData ? ytdRevenue.value : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-ops-text-muted mb-0.5">ytd expenses</p>
              <p className="text-sm text-ops-text tabular-nums leading-none">
                ${ytdExpenses?.hasData ? ytdExpenses.value : '—'}
              </p>
            </div>
          </div>
          {/* Runway bar */}
          {runway !== null && (
            <div className="h-1.5 rounded-full bg-ops-border/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  runway < 1 ? 'bg-red-500' : runway < 3 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(runwayPct * 100, 3)}%` }}
              />
            </div>
          )}
        </div>

        {/* ── alerts ──────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="space-y-2 mb-6">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2.5 px-4 py-2.5 rounded-lg text-[13px] ${
                a.level === 'critical'
                  ? 'bg-red-500/8 border border-red-500/20 text-red-300'
                  : 'bg-amber-500/8 border border-amber-500/20 text-amber-300'
              }`}>
                <span className="flex-shrink-0 mt-0.5">
                  {a.level === 'critical' ? (
                    <StatusBadge status="blocked" size="sm" showLabel={false} />
                  ) : (
                    <StatusBadge status="at-risk" size="sm" showLabel={false} />
                  )}
                </span>
                <div>
                  <span className="font-medium">{a.text}</span>
                  {a.detail && <span className="text-ops-text-muted ml-1.5">— {a.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── projects + deadlines (grouped by concern) ───────── */}
        <div className="mb-6">
          <Section title="projects" badge={
            warningProjects.length > 0 ? (
              <StatusBadge status="at-risk" label={`${warningProjects.length} needs attention`} />
            ) : undefined
          }>
            <div className="rounded-lg border border-ops-border overflow-hidden divide-y divide-ops-border/40">
              {projects.map(project => (
                <div key={project.id} id={`project-${project.id}`}>
                  <button
                    onClick={() => setDrawerProject(drawerProject?.id === project.id ? null : project)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <StatusBadge status={projectStatusToBadge(project.status)} size="sm" showLabel={false} />
                    <span className="text-[13px] text-ops-text flex-1 truncate">{project.name}</span>
                    {project.owner && (
                      <span className="text-[11px] text-ops-text-muted hidden sm:inline flex-shrink-0">{project.owner}</span>
                    )}
                    {project.deadline && (
                      <span className="text-[11px] text-amber-400/70 font-medium tabular-nums flex-shrink-0">{project.deadline}</span>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Inline deadlines under projects */}
            {highPriorityDeadlines.length > 0 && (
              <div className="mt-3 space-y-2">
                {highPriorityDeadlines.map(d => {
                  const days = daysUntil(d.date);
                  return (
                    <div key={d.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-amber-500/15 bg-amber-500/[0.03]">
                      <StatusBadge status={days <= 7 ? 'blocked' : 'at-risk'} size="sm" showLabel={false} />
                      <span className="text-[13px] text-ops-text flex-1">{d.title}</span>
                      <span className={`text-[11px] font-bold tabular-nums ${
                        days <= 7 ? 'text-red-400' : 'text-amber-400'
                      }`}>{days}d</span>
                      <span className="text-[10px] text-ops-text-muted hidden sm:inline">
                        {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* ── two-column: tasks + schedule ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">

          {/* ── LEFT: action items (3/5) ──────────────────────── */}
          <div className="lg:col-span-3">
            <Section title="action items" badge={
              activeTasks.length > 0 ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-ops-border text-ops-text-muted tabular-nums">
                  {activeTasks.length}
                </span>
              ) : undefined
            }>
              {highTasks.length > 0 && (
                <div className="mb-2">
                  {highTasks.map(task => (
                    <TaskRow key={task.id} task={task} checked={false} onToggle={toggleTask} priority />
                  ))}
                </div>
              )}
              {otherTasks.length > 0 && (
                <div className={highTasks.length > 0 ? 'pt-1 border-t border-ops-border/30' : ''}>
                  {otherTasks.map(task => (
                    <TaskRow key={task.id} task={task} checked={false} onToggle={toggleTask} />
                  ))}
                </div>
              )}
              {doneTasks.length > 0 && (
                <div className="pt-2 mt-2 border-t border-ops-border/30">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-ops-text-muted mb-1 px-1">
                    done ({doneTasks.length})
                  </p>
                  {doneTasks.map(task => (
                    <TaskRow key={task.id} task={task} checked onToggle={toggleTask} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* ── RIGHT: schedule + dispatch (2/5) ──────────────── */}
          <div className="lg:col-span-2">
            <Section title="this week">
              <div className="space-y-0.5">
                {upcomingMeetings.map(meeting => (
                  <button
                    key={meeting.id}
                    onClick={() => setDrawerMeeting(meeting)}
                    className="flex gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors w-full text-left cursor-pointer"
                  >
                    <div className="w-10 text-right flex-shrink-0">
                      <p className="text-[10px] font-semibold text-ops-text-muted uppercase leading-tight">
                        {meeting.day.slice(0, 3)}
                      </p>
                      <p className="text-[11px] text-ops-text tabular-nums">{meeting.time.replace(' PM', 'p').replace(' AM', 'a')}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ops-text truncate">{meeting.title}</p>
                      {meeting.attendees && (
                        <p className="text-[10px] text-ops-text-muted truncate">{meeting.attendees.join(', ')}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="dispatch">
              <div className="space-y-1">
                {dispatchTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2.5 px-2 py-1.5">
                    <StatusBadge
                      status={task.status === 'success' ? 'on-track' : 'pending'}
                      size="sm"
                      showLabel={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-mono text-ops-text">{task.name}</p>
                    </div>
                    <span className="text-[10px] text-ops-text-muted tabular-nums">{task.schedule}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>

        {/* ── team (collapsed by default) ─────────────────────── */}
        <Section title="team" defaultOpen={false} badge={
          <span className="text-[10px] text-ops-text-muted">{teamMembers.length}</span>
        }>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-ops-border/30 rounded-lg overflow-hidden border border-ops-border">
            {teamMembers.map(member => (
              <div
                key={member.id}
                className="bg-ops-bg px-3.5 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-ops-border flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-ops-text-muted uppercase">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] text-ops-text truncate">{member.name}</p>
                    <p className="text-[10px] text-ops-text-muted truncate">{member.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </main>

      {/* ── footer with staleness indicator ──────────────────── */}
      <StalenessBar dataAsOf={dataAsOf} />

      {/* ── project detail drawer ────────────────────────────── */}
      <DetailDrawer
        open={drawerProject !== null}
        onClose={closeDrawer}
        title={drawerProject?.name ?? ''}
        subtitle={drawerProject?.owner ? `Lead: ${drawerProject.owner}` : undefined}
        badge={drawerProject ? <StatusBadge status={projectStatusToBadge(drawerProject.status)} /> : undefined}
      >
        {drawerProject && (
          <>
            <DrawerSection title="Description">
              <p className="text-[13px] text-ops-text leading-relaxed">
                {drawerProject.description || 'No description available.'}
              </p>
            </DrawerSection>
            {drawerProject.deadline && (
              <DrawerSection title="Deadline">
                <DrawerField label="Due date" value={drawerProject.deadline} />
                <DrawerField label="Days remaining" value={
                  <span className={`font-semibold tabular-nums ${
                    daysUntil(drawerProject.deadline) <= 7 ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {daysUntil(drawerProject.deadline)} days
                  </span>
                } />
              </DrawerSection>
            )}
            <DrawerSection title="Related Tasks">
              {tasks.filter(t => t.category === drawerProject.name || t.category.includes(drawerProject.name.split(' ')[0])).length > 0 ? (
                <div className="space-y-1">
                  {tasks
                    .filter(t => t.category === drawerProject.name || t.category.includes(drawerProject.name.split(' ')[0]))
                    .map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-[12px]">
                        <StatusBadge status={checked.has(t.id) ? 'complete' : t.priority === 'high' ? 'at-risk' : 'pending'} size="sm" showLabel={false} />
                        <span className={checked.has(t.id) ? 'line-through text-ops-text-muted' : 'text-ops-text'}>
                          {t.title}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-[12px] text-ops-text-muted">No tasks linked to this project.</p>
              )}
            </DrawerSection>
          </>
        )}
      </DetailDrawer>

      {/* ── meeting detail drawer ────────────────────────────── */}
      <DetailDrawer
        open={drawerMeeting !== null}
        onClose={closeDrawer}
        title={drawerMeeting?.title ?? ''}
        subtitle={drawerMeeting ? `${drawerMeeting.day} · ${drawerMeeting.time}` : undefined}
      >
        {drawerMeeting && (
          <>
            <DrawerSection title="Schedule">
              <DrawerField label="Day" value={drawerMeeting.day} />
              <DrawerField label="Time" value={`${drawerMeeting.time} ${drawerMeeting.timezone}`} />
            </DrawerSection>
            {drawerMeeting.attendees && drawerMeeting.attendees.length > 0 && (
              <DrawerSection title="Attendees">
                <div className="space-y-1">
                  {drawerMeeting.attendees.map((name, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-ops-border flex items-center justify-center flex-shrink-0">
                        <span className="text-[8px] font-bold text-ops-text-muted uppercase">{name[0]}</span>
                      </span>
                      <span className="text-[13px] text-ops-text">{name}</span>
                    </div>
                  ))}
                </div>
              </DrawerSection>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
