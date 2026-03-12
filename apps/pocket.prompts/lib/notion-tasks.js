import { Client } from '@notionhq/client';

const tasks_db_id = (process.env.NOTION_TASKS_DB_ID || '').trim();

function get_client(token) {
  return new Client({ auth: token || (process.env.NOTION_API_KEY || '').trim() });
}

/**
 * Parse a natural-language due date into an ISO date string.
 * Handles: "tomorrow", "friday", "next week", "march 15", "2026-03-15", etc.
 * Returns null if parsing fails or input is empty.
 */
function parse_due_date(due_date_str) {
  if (!due_date_str) return null;

  const normalized = due_date_str.toLowerCase().trim();
  const today = new Date();

  // already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return normalized.substring(0, 10);
  }

  // relative dates
  if (normalized === 'today') {
    return fmt(today);
  }
  if (normalized === 'tomorrow') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return fmt(d);
  }
  if (normalized === 'next week') {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return fmt(d);
  }
  if (normalized === 'end of week' || normalized === 'eow') {
    const d = new Date(today);
    const day = d.getDay();
    d.setDate(d.getDate() + (5 - day + (day > 5 ? 7 : 0))); // next friday
    return fmt(d);
  }

  // day names: "monday", "tuesday", "friday", etc.
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day_index = days.indexOf(normalized);
  if (day_index !== -1) {
    const d = new Date(today);
    const current_day = d.getDay();
    let diff = day_index - current_day;
    if (diff <= 0) diff += 7; // next occurrence
    d.setDate(d.getDate() + diff);
    return fmt(d);
  }

  // "in X days"
  const in_days = normalized.match(/^in\s+(\d+)\s+days?$/);
  if (in_days) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(in_days[1], 10));
    return fmt(d);
  }

  // month + day: "march 15", "jan 3"
  const month_day = normalized.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})$/);
  if (month_day) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const m = months[month_day[1].substring(0, 3)];
    const d_num = parseInt(month_day[2], 10);
    const year = (m < today.getMonth() || (m === today.getMonth() && d_num < today.getDate()))
      ? today.getFullYear() + 1
      : today.getFullYear();
    return fmt(new Date(year, m, d_num));
  }

  console.log(`[notion-tasks] could not parse due date: "${due_date_str}"`);
  return null;
}

function fmt(d) {
  return d.toISOString().substring(0, 10);
}

/**
 * Infer task type from content keywords.
 * Falls back to 'implement' if nothing matches.
 */
function infer_task_type(content) {
  if (!content) return 'implement';
  const c = content.toLowerCase();

  if (/\b(plan|planning|roadmap|strategy)\b/.test(c)) return 'plan';
  if (/\b(design|wireframe|mockup|prototype|figma|layout)\b/.test(c)) return 'design';
  if (/\b(research|explore|investigate|analyze|compare)\b/.test(c)) return 'research';
  if (/\b(review|feedback|critique|check|audit)\b/.test(c)) return 'review';
  if (/\b(publish|present|share|launch|release|announce)\b/.test(c)) return 'publish-present';
  if (/\b(adapt|modify|adjust|customize|tailor)\b/.test(c)) return 'adapt';
  if (/\b(coordinate|schedule|organize|arrange|meeting)\b/.test(c)) return 'coordinate';
  if (/\b(support|help|assist|fix|debug|troubleshoot)\b/.test(c)) return 'support';
  if (/\b(admin|setup|configure|install|update|maintain)\b/.test(c)) return 'admin';

  return 'implement';
}

/**
 * Create a task directly in the @tasks Notion database.
 *
 * @param {object} opts
 * @param {string} opts.content — task title/description
 * @param {string} [opts.priority] — low | medium | high | urgent
 * @param {string} [opts.assignee_notion_id] — Notion user UUID
 * @param {string} [opts.due_date] — natural language or ISO date
 * @param {string} [opts.task_type] — plan | design | research | implement | etc.
 * @returns {{ success: boolean, page_id?: string, url?: string, error?: string }}
 */
export async function create_task({ content, priority, assignee_notion_id, due_date, task_type, token }) {
  if (!tasks_db_id) {
    console.error('[notion-tasks] NOTION_TASKS_DB_ID not set');
    return { success: false, error: 'NOTION_TASKS_DB_ID not configured' };
  }

  try {
    const notion = get_client(token);

    const properties = {
      task: {
        title: [{ text: { content } }]
      },
      status: {
        status: { name: 'in queue' }
      }
    };

    // priority — only add if valid
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority.toLowerCase())) {
      properties.priority = { select: { name: priority.toLowerCase() } };
    }

    // owner — person property
    if (assignee_notion_id) {
      properties.owner = {
        people: [{ id: assignee_notion_id }]
      };
    }

    // due date — parse natural language
    const parsed_date = parse_due_date(due_date);
    if (parsed_date) {
      properties['due date'] = {
        date: { start: parsed_date }
      };
    }

    // task type — infer from content if not provided
    const resolved_type = task_type || infer_task_type(content);
    properties['task type'] = { select: { name: resolved_type } };

    console.log(`[notion-tasks] creating task: "${content.substring(0, 50)}..." → ${resolved_type}, priority: ${priority || 'none'}`);

    const page = await notion.pages.create({
      parent: { database_id: tasks_db_id },
      properties
    });

    console.log(`[notion-tasks] created: ${page.id}`);

    return {
      success: true,
      page_id: page.id,
      url: page.url
    };
  } catch (err) {
    console.error(`[notion-tasks] create failed: ${err.message}`);
    return {
      success: false,
      error: err.message
    };
  }
}
