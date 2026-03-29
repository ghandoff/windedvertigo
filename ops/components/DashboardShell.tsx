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
    <div className="min-h-screen bg-ops-bg text-ops-text">
      {/* Header */}
      <header className="border-b border-ops-border sticky top-0 bg-ops-bg/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-6 py-8 sm:py-10">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-ops-text lowercase tracking-tight">
                winded.vertigo
              </h1>
              <p className="text-sm text-ops-textMuted mt-1 lowercase tracking-wide">
                ops · command center
              </p>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-ops-textMuted lowercase hidden sm:inline">
                {user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-xs text-ops-textMuted hover:text-ops-text transition-colors lowercase"
                >
                  sign out
                </button>
              </form>
              <span className="text-xs text-ops-textMuted lowercase">
                {date}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 sm:py-12">
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
          <div className="mt-6 p-5 bg-ops-card border border-yellow-800/50 rounded-lg">
            <p className="text-sm text-yellow-300">
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

      {/* Footer */}
      <footer className="border-t border-ops-border bg-ops-bg/50 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-ops-textMuted lowercase">
            powered by cowork dispatch
          </p>
        </div>
      </footer>
    </div>
  );
}
