import { Client } from '@notionhq/client';

const tasks_db_id = (process.env.NOTION_TASKS_DB_ID || '').trim();
const playdates_db_id = (process.env.NOTION_DB_PLAYDATES || '').trim();
const meetings_db_id = (process.env.NOTION_MEETINGS_DB_ID || '').trim();
const goals_db_id = (process.env.NOTION_GOALS_DB_ID || '').trim();

function get_client() {
  return new Client({ auth: (process.env.NOTION_API_KEY || '').trim() });
}

function get_week_bounds() {
  const now = new Date();
  const day = now.getDay();

  // start of this week (monday)
  const week_start = new Date(now);
  week_start.setDate(now.getDate() - ((day + 6) % 7));
  week_start.setHours(0, 0, 0, 0);

  // end of this week (sunday)
  const week_end = new Date(week_start);
  week_end.setDate(week_start.getDate() + 6);
  week_end.setHours(23, 59, 59, 999);

  return {
    start: week_start.toISOString().substring(0, 10),
    end: week_end.toISOString().substring(0, 10)
  };
}

function extract_title(page) {
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === 'title' && prop.title?.length > 0) {
      return prop.title.map(t => t.plain_text).join('');
    }
  }
  return 'Untitled';
}

function extract_select(page, name) {
  const prop = page.properties[name];
  if (!prop) return null;
  if (prop.type === 'select') return prop.select?.name || null;
  if (prop.type === 'status') return prop.status?.name || null;
  return null;
}

function extract_date(page, name) {
  const prop = page.properties[name];
  if (!prop || prop.type !== 'date') return null;
  return prop.date?.start || null;
}

function extract_people(page, name) {
  const prop = page.properties[name];
  if (!prop || prop.type !== 'people') return [];
  return prop.people.map(p => p.name || p.id);
}

function extract_rich_text(page, name) {
  const prop = page.properties[name];
  if (!prop || prop.type !== 'rich_text') return '';
  return prop.rich_text.map(t => t.plain_text).join('');
}

async function query_with_retry(notion, database_id, params, label) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await notion.databases.query({ database_id, ...params });
      return response.results;
    } catch (err) {
      console.error(`[weekly-summary] ${label} query attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return [];
}

async function fetch_tasks(notion, bounds) {
  if (!tasks_db_id) {
    console.log('[weekly-summary] skipping tasks — NOTION_TASKS_DB_ID not set');
    return { completed: [], in_progress: [], due_soon: [] };
  }

  const results = await query_with_retry(notion, tasks_db_id, {
    filter: {
      or: [
        // completed this week
        {
          and: [
            { property: 'status', status: { equals: 'done' } },
            { timestamp: 'last_edited_time', last_edited_time: { on_or_after: bounds.start } }
          ]
        },
        // in progress
        { property: 'status', status: { equals: 'in progress' } },
        // in queue
        { property: 'status', status: { equals: 'in queue' } },
        // due this week
        {
          and: [
            { property: 'due date', date: { on_or_after: bounds.start } },
            { property: 'due date', date: { on_or_before: bounds.end } }
          ]
        }
      ]
    }
  }, 'tasks');

  const completed = [];
  const in_progress = [];
  const due_soon = [];

  for (const page of results) {
    const task = {
      title: extract_title(page),
      status: extract_select(page, 'status'),
      priority: extract_select(page, 'priority'),
      due_date: extract_date(page, 'due date'),
      owner: extract_people(page, 'owner'),
      url: page.url
    };

    if (task.status === 'done') {
      completed.push(task);
    } else if (task.status === 'in progress') {
      in_progress.push(task);
    } else {
      due_soon.push(task);
    }
  }

  console.log(`[weekly-summary] tasks: ${completed.length} done, ${in_progress.length} in progress, ${due_soon.length} queued/due`);
  return { completed, in_progress, due_soon };
}

async function fetch_events(notion, bounds) {
  if (!playdates_db_id) {
    console.log('[weekly-summary] skipping events — NOTION_DB_PLAYDATES not set');
    return [];
  }

  const results = await query_with_retry(notion, playdates_db_id, {
    filter: {
      and: [
        { property: 'date', date: { on_or_after: bounds.start } },
        { property: 'date', date: { on_or_before: bounds.end } }
      ]
    },
    sorts: [{ property: 'date', direction: 'ascending' }]
  }, 'events');

  const events = results.map(page => ({
    title: extract_title(page),
    date: extract_date(page, 'date'),
    status: extract_select(page, 'status'),
    url: page.url
  }));

  console.log(`[weekly-summary] events: ${events.length} this week`);
  return events;
}

async function fetch_meetings(notion, bounds) {
  if (!meetings_db_id) {
    console.log('[weekly-summary] skipping meetings — NOTION_MEETINGS_DB_ID not set');
    return [];
  }

  const results = await query_with_retry(notion, meetings_db_id, {
    filter: {
      and: [
        { timestamp: 'last_edited_time', last_edited_time: { on_or_after: bounds.start } },
        { timestamp: 'last_edited_time', last_edited_time: { on_or_before: bounds.end + 'T23:59:59Z' } }
      ]
    },
    sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
  }, 'meetings');

  const meetings = results.map(page => ({
    title: extract_title(page),
    date: extract_date(page, 'date') || page.last_edited_time?.substring(0, 10),
    notes: extract_rich_text(page, 'notes') || extract_rich_text(page, 'summary'),
    url: page.url
  }));

  console.log(`[weekly-summary] meetings: ${meetings.length} this week`);
  return meetings;
}

async function fetch_goals(notion) {
  if (!goals_db_id) {
    console.log('[weekly-summary] skipping goals — NOTION_GOALS_DB_ID not set');
    return [];
  }

  const results = await query_with_retry(notion, goals_db_id, {
    sorts: [{ property: 'status', direction: 'ascending' }]
  }, 'goals');

  const goals = results.map(page => ({
    title: extract_title(page),
    status: extract_select(page, 'status') || 'not started',
    owner: extract_people(page, 'owner'),
    due_date: extract_date(page, 'due date'),
    url: page.url
  }));

  console.log(`[weekly-summary] goals: ${goals.length} total`);
  return goals;
}

export async function fetch_week_data() {
  const notion = get_client();
  const bounds = get_week_bounds();

  console.log(`[weekly-summary] fetching data for week ${bounds.start} to ${bounds.end}`);

  // query all sources in parallel with 350ms stagger to respect rate limits
  const [tasks, events, meetings, goals] = await Promise.all([
    fetch_tasks(notion, bounds),
    new Promise(r => setTimeout(r, 350)).then(() => fetch_events(notion, bounds)),
    new Promise(r => setTimeout(r, 700)).then(() => fetch_meetings(notion, bounds)),
    new Promise(r => setTimeout(r, 1050)).then(() => fetch_goals(notion))
  ]);

  const stats = {
    completed: tasks.completed.length,
    in_progress: tasks.in_progress.length,
    due_soon: tasks.due_soon.length,
    events: events.length,
    meetings: meetings.length,
    goals_total: goals.length,
    goals_in_progress: goals.filter(g => g.status === 'in progress').length,
    goals_done: goals.filter(g => g.status === 'done').length
  };

  return { tasks, events, meetings, goals, stats, bounds };
}
