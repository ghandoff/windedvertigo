import { NextResponse } from 'next/server';
import {
  projects,
  teamMembers,
  upcomingMeetings,
  deadlines,
  tasks,
  dispatchTasks,
  financialMetrics,
  dataAsOf,
} from '@/lib/data';
import { kvGet } from '@/lib/kv';
import type {
  FinancialMetric,
  TeamMember,
  Meeting,
  Task,
  DispatchTask,
} from '@/lib/types';

/**
 * GET /api/actions/export
 * Returns a full JSON snapshot of all dashboard data.
 * Tries KV first, falls back to static.
 */
export async function GET() {
  try {
    const [kvFinance, kvTeam, kvCalendar, kvTasks, kvDispatch] = await Promise.all([
      kvGet<FinancialMetric[]>('ops:finance'),
      kvGet<TeamMember[]>('ops:team'),
      kvGet<Meeting[]>('ops:calendar'),
      kvGet<Task[]>('ops:tasks'),
      kvGet<DispatchTask[]>('ops:dispatch'),
    ]);

    const snapshot = {
      exportedAt: new Date().toISOString(),
      dataAsOf,
      finance: kvFinance ?? financialMetrics,
      projects,
      team: kvTeam ?? teamMembers,
      calendar: kvCalendar ?? upcomingMeetings,
      deadlines,
      tasks: kvTasks ?? tasks,
      dispatch: kvDispatch ?? dispatchTasks,
    };

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ops-snapshot-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Export failed' }, { status: 500 });
  }
}
