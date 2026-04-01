// Dashboard data — static fallback until KV integrations land.
// Types live in lib/types.ts, shared by API routes + components.

import type {
  Project,
  TeamMember,
  Meeting,
  Deadline,
  Task,
  DispatchTask,
  FinancialMetric,
} from './types';

export type { Project, TeamMember, Meeting, Deadline, Task, DispatchTask, FinancialMetric };

// Data freshness — when this snapshot was last updated
export const dataAsOf = '2026-03-28T12:00:00Z';

// Projects
export const projects: Project[] = [
  {
    id: 'idb-salvador',
    name: 'IDB Salvador',
    status: 'yellow',
    deadline: 'April 10, 2026',
    owner: 'Maria',
    description: 'Ed-tech modernization procurement SDP 01/2026',
  },
  {
    id: 'prme-2026',
    name: 'PRME 2026',
    status: 'green',
    owner: 'Meredith / Sam',
    description: 'Contract signed · first invoice submitted Mar 27',
  },
  {
    id: 'amna-at-10',
    name: 'Amna at 10',
    status: 'green',
    owner: 'Team',
    description: 'Evidence synthesis & impact report',
  },
  {
    id: 'lego-superskills',
    name: 'LEGO / Superskills!',
    status: 'green',
    owner: 'Team',
    description: 'Cross-cutting skills certification',
  },
  {
    id: 'sesame-workshop',
    name: 'Sesame Workshop',
    status: 'green',
    owner: 'Team',
    description: 'Learning design engagement',
  },
  {
    id: 'unicef',
    name: 'UNICEF',
    status: 'green',
    owner: 'Team',
    description: 'Learning design engagement',
  },
  {
    id: 'website-launch',
    name: 'Website Launch',
    status: 'green',
    owner: 'Payton',
    description: 'windedvertigo.com soft launched Mar 27',
  },
  {
    id: '401k-cpa',
    name: '401k / CPA',
    status: 'yellow',
    owner: 'Garrett',
    description: 'Plan #156733 with ADP — final 5500 + testing',
  },
];

// Team members
export const teamMembers: TeamMember[] = [
  {
    id: 'garrett',
    name: 'Garrett Jaeger',
    role: 'Director · W-2 · $10k/mo',
    focus: ['IDB Salvador', 'PRME 2026', 'Ops & Strategy'],
  },
  {
    id: 'payton',
    name: 'Payton Jaeger',
    role: 'Communications · W-2 · $50/hr',
    focus: ['Website', 'Outreach', 'Circulation'],
  },
  {
    id: 'lamis',
    name: 'Lamis Sabra',
    role: 'w.v Collective',
    focus: ['Weekly Sync', 'Coordination'],
  },
  {
    id: 'maria',
    name: 'Maria Altamirano G.',
    role: 'Operations',
    focus: ['IDB Salvador Lead', 'Operations', 'Admin'],
  },
  {
    id: 'james',
    name: 'James Galpin',
    role: 'w.v Collective',
    focus: ['Collective Work'],
  },
];

// Upcoming meetings & deadlines
export const upcomingMeetings: Meeting[] = [
  {
    id: 'whirlpool-1',
    title: 'whirlpool x Press Play',
    day: 'Monday',
    time: '4:00 PM',
    timezone: 'UTC',
    attendees: ['Lamis', 'Payton', 'Maria'],
  },
  {
    id: 'lamis-sync',
    title: 'lamis x garrett',
    day: 'Tuesday',
    time: '4:00 PM',
    timezone: 'UTC',
    attendees: ['Lamis', 'Garrett'],
  },
  {
    id: 'randall',
    title: 'Randall call',
    day: 'Tuesday',
    time: '5:00 PM',
    timezone: 'UTC',
    attendees: ['Randall', 'Gina'],
  },
  {
    id: 'maria-sync',
    title: 'garrett x maria (pt i)',
    day: 'Tuesday',
    time: '6:00 PM',
    timezone: 'UTC',
    attendees: ['Garrett', 'Maria'],
  },
  {
    id: 'prme-hold',
    title: 'PRME hold',
    day: 'Tuesday',
    time: '7:00 PM',
    timezone: 'UTC',
    attendees: ['Meredith', 'Sam'],
  },
  {
    id: 'rnd-meeting',
    title: 'R&D meeting',
    day: 'Friday',
    time: '6:00 PM',
    timezone: 'UTC',
    attendees: ['Gina'],
  },
];

// Deadlines
export const deadlines: Deadline[] = [
  {
    id: 'idb-deadline',
    title: 'IDB Salvador proposal',
    date: '2026-04-10',
    project: 'IDB Salvador',
    priority: 'high',
  },
];

// Tasks
export const tasks: Task[] = [
  {
    id: 'idb-docs-1',
    title: 'IDB: Collect missing documents',
    category: 'IDB Salvador',
    assigned: 'Jamie / Maria',
    priority: 'high',
    subtasks: ['Jamie: 3 items pending', 'Maria: 1 item pending'],
  },
  {
    id: 'idb-docs-2',
    title: 'IDB: Pull docs from Drive',
    category: 'IDB Salvador',
    assigned: 'Garrett',
    priority: 'high',
  },
  {
    id: 'prme-invoice',
    title: 'PRME: Await first payment',
    category: 'PRME 2026',
    assigned: 'Garrett',
    priority: 'high',
  },
  {
    id: 'amna-await',
    title: 'Amna: Await response on proposal',
    category: 'Amna at 10',
    assigned: 'Team',
    priority: 'medium',
  },
  {
    id: '401k-testing',
    title: '401k: Final 5500 + year-end testing',
    category: '401k / CPA',
    assigned: 'CPA / Garrett',
    priority: 'medium',
  },
  {
    id: 'financial-populate',
    title: 'Populate cash position, revenue, CPA info',
    category: 'Finance',
    assigned: 'Garrett',
    priority: 'low',
  },
];

// Dispatch status
export const dispatchTasks: DispatchTask[] = [
  {
    id: 'weekly-cfo',
    name: 'weekly-cfo-review',
    schedule: 'Mon 9:05 AM',
    lastRan: 'Mar 23, 2026',
    status: 'success',
  },
  {
    id: 'invoice-proc',
    name: 'invoice-processor',
    schedule: 'Daily 9:00 AM',
    lastRan: 'Mar 28, 2026',
    status: 'success',
  },
];

// Financial metrics — sourced from QuickBooks + Gusto (2026-03-28)
export const financialMetrics: FinancialMetric[] = [
  {
    label: 'Cash Position',
    value: '2,072',
    currency: true,
    hasData: true,
  },
  {
    label: 'Monthly Burn',
    value: '4,275',
    currency: true,
    hasData: true,
  },
  {
    label: 'YTD Expenses',
    value: '12,826',
    currency: true,
    hasData: true,
  },
  {
    label: 'YTD Revenue',
    value: '0',
    currency: true,
    hasData: true,
  },
];
