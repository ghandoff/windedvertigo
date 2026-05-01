export interface Project {
  id: string;
  name: string;
  status: 'green' | 'yellow' | 'red';
  deadline?: string;
  owner?: string;
  description?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  focus: string[];
}

export interface Meeting {
  id: string;
  title: string;
  day: string;
  time: string;
  timezone: string;
  attendees?: string[];
}

export interface Deadline {
  id: string;
  title: string;
  date: string;
  project: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Task {
  id: string;
  title: string;
  category: string;
  assigned?: string;
  priority?: 'high' | 'medium' | 'low';
  subtasks?: string[];
}

export interface DispatchTask {
  id: string;
  name: string;
  schedule: string;
  lastRan: string;
  status: 'success' | 'pending';
}

export interface FinancialMetric {
  label: string;
  value?: string | number;
  currency?: boolean;
  hasData: boolean;
}

export interface ContentItem {
  id: string;
  title: string;
  channel: string;
  body?: string;
  scheduledDate?: string;
  status: string;
}

export interface CampaignMetrics {
  campaignId: string;
  name: string;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  status: string;
}

export interface PipelineSummary {
  identified: number;
  pitched: number;
  proposal: number;
  won: number;
  lost: number;
  totalValue?: number;
}
