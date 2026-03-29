'use client';

import { useState, useEffect } from 'react';
import { signOutAction } from '@/app/actions';
import type {
  Project,
  TeamMember,
  Meeting,
  Task,
  DispatchTask,
  FinancialMetric,
} from '@/lib/data';
import { ProjectCard } from '@/components/ProjectCard';
import { FinancialMetricCard } from '@/components/FinancialMetricCard';
import { TeamMemberCard } from '@/components/TeamMemberCard';
import { MeetingCard } from '@/components/MeetingCard';
import { TaskCard } from '@/components/TaskCard';
import { DispatchCard } from '@/components/DispatchCard';
import { SectionHeader } from '@/components/SectionHeader';

interface DashboardShellProps {
  data: {
    projects: Project[];
    teamMembers: TeamMember[];
    upcomingMeetings: Meeting[];
    tasks: Task[];
    dispatchTasks: DispatchTask[];
    financialMetrics: FinancialMetric[];
  };
  user: {
    email: string;
    firstName: string;
  };
  date: string;
}

export function DashboardShell({ data, user, date }: DashboardShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const { projects, teamMembers, upcomingMeetings, tasks, dispatchTasks, financialMetrics } = data;

  return (
    <div className="min-h-screen flex flex-col bg-ops-bg text-ops-text">
      {/* Header — shared .wv-header chrome (cadet bg, champagne text) */}
      <header className="wv-header sticky top-0 z-50">
        <a href="/" className="wv-header-brand">winded.vertigo</a>
        <nav className="wv-header-nav">
          <span className="wv-header-email hidden sm:inline">{user.email}</span>
          <span className="wv-header-nav-link" style={{ opacity: 0.5, fontSize: '0.75rem' }}>{date}</span>
          <form action={signOutAction}>
            <button type="submit" className="wv-header-signout">
              sign out
            </button>
          </form>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-6 py-10 sm:py-12 flex-1">
        {/* Project Health */}
        <section>
          <SectionHeader
            title="project health"
            subtitle="status, deadlines & ownership"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        </section>

        {/* Financial Snapshot */}
        <section>
          <SectionHeader
            title="financial snapshot"
            subtitle="revenue, burn & cash position"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {financialMetrics.map((metric, index) => (
              <FinancialMetricCard key={metric.label} metric={metric} index={index} />
            ))}
          </div>
        </section>

        {/* Team Pulse */}
        <section>
          <SectionHeader
            title="team pulse"
            subtitle="who · role · current focus"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamMembers.map((member, index) => (
              <TeamMemberCard key={member.id} member={member} index={index} />
            ))}
          </div>
        </section>

        {/* Upcoming */}
        <section>
          <SectionHeader
            title="upcoming"
            subtitle="next 7 days · meetings & deadlines"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {upcomingMeetings.map((meeting, index) => (
              <MeetingCard key={meeting.id} meeting={meeting} index={index} />
            ))}
          </div>

          {/* Deadline callout */}
          <div className="mt-6 p-5 bg-ops-card border rounded-lg" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--color-warning-border)' }}>
              <span className="font-semibold">deadline</span> · IDB Salvador proposal due{' '}
              <span className="font-semibold">April 10, 2026</span>
            </p>
          </div>
        </section>

        {/* Dispatch Status */}
        <section>
          <SectionHeader
            title="dispatch status"
            subtitle="automated tasks & schedules"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dispatchTasks.map((task, index) => (
              <DispatchCard key={task.id} task={task} index={index} />
            ))}
          </div>
        </section>

        {/* Tasks */}
        <section>
          <SectionHeader
            title="action items"
            subtitle="open tasks by priority"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))}
          </div>
        </section>
      </main>

      {/* Footer — shared .wv-footer chrome */}
      <footer className="wv-footer">
        <div className="wv-footer-inner">
          <p className="wv-footer-copyright">powered by cowork dispatch</p>
          <p className="wv-footer-copyright">&copy; {new Date().getFullYear()} winded.vertigo llc</p>
        </div>
      </footer>
    </div>
  );
}
