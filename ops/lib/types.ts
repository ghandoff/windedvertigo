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

export interface Task {
  id: string;
  title: string;
  category: string;
  assigned?: string;
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
