import { Client } from '@notionhq/client';

const summaries_parent_id = (process.env.NOTION_WEEKLY_SUMMARIES_PAGE_ID || '').trim();

function get_client() {
  return new Client({ auth: (process.env.NOTION_API_KEY || '').trim() });
}

function format_date_range(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

function heading(level, text) {
  const key = `heading_${level}`;
  return { type: key, [key]: { rich_text: [{ type: 'text', text: { content: text } }] } };
}

function paragraph(text) {
  return { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } };
}

function divider() {
  return { type: 'divider', divider: {} };
}

function todo_item(text, checked) {
  return { type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: text } }], checked } };
}

function bulleted(text) {
  return { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: text } }] } };
}

function build_blocks(data) {
  const blocks = [];
  const { tasks, events, meetings, goals, stats } = data;

  // at a glance
  blocks.push(heading(2, 'This Week at a Glance'));
  blocks.push(paragraph(
    `Completed: ${stats.completed} tasks  ·  In Progress: ${stats.in_progress}  ·  Events: ${stats.events}  ·  Meetings: ${stats.meetings}`
  ));
  blocks.push(divider());

  // completed tasks
  if (tasks.completed.length > 0) {
    blocks.push(heading(2, 'Completed Tasks'));
    for (const t of tasks.completed) {
      const owner = t.owner.length > 0 ? ` (${t.owner.join(', ')})` : '';
      blocks.push(todo_item(`${t.title}${owner}`, true));
    }
  }

  // in progress
  if (tasks.in_progress.length > 0) {
    blocks.push(heading(2, 'In Progress'));
    for (const t of tasks.in_progress) {
      const owner = t.owner.length > 0 ? ` — ${t.owner.join(', ')}` : '';
      const due = t.due_date ? ` — due ${t.due_date}` : '';
      blocks.push(todo_item(`${t.title}${owner}${due}`, false));
    }
  }

  // due soon / queued
  if (tasks.due_soon.length > 0) {
    blocks.push(heading(2, 'Coming Up'));
    for (const t of tasks.due_soon) {
      const owner = t.owner.length > 0 ? ` — ${t.owner.join(', ')}` : '';
      const due = t.due_date ? ` — due ${t.due_date}` : '';
      blocks.push(todo_item(`${t.title}${owner}${due}`, false));
    }
  }

  blocks.push(divider());

  // events
  if (events.length > 0) {
    blocks.push(heading(2, 'Events This Week'));
    for (const e of events) {
      const date = e.date ? ` — ${e.date}` : '';
      blocks.push(bulleted(`${e.title}${date}`));
    }
  }

  // meetings
  if (meetings.length > 0) {
    blocks.push(heading(2, 'Meeting Highlights'));
    for (const m of meetings) {
      const date = m.date ? ` — ${m.date}` : '';
      blocks.push(bulleted(`${m.title}${date}`));
      if (m.notes) {
        blocks.push(paragraph(`  ${m.notes.substring(0, 200)}${m.notes.length > 200 ? '...' : ''}`));
      }
    }
  }

  blocks.push(divider());

  // goals
  if (goals.length > 0) {
    blocks.push(heading(2, 'Goal Progress'));
    for (const g of goals) {
      const owner = g.owner.length > 0 ? ` — ${g.owner.join(', ')}` : '';
      const checked = g.status === 'done';
      blocks.push(todo_item(`${g.title} [${g.status}]${owner}`, checked));
    }
  }

  // footer
  blocks.push(divider());
  blocks.push(paragraph(`Generated ${new Date().toISOString().substring(0, 16).replace('T', ' ')} UTC by weekly summary bot`));

  return blocks;
}

export async function create_summary_page(data) {
  const notion = get_client();
  const title = `Week of ${format_date_range(data.bounds.start, data.bounds.end)}`;
  const blocks = build_blocks(data);

  // notion limits appending to 100 blocks at a time
  const block_chunks = [];
  for (let i = 0; i < blocks.length; i += 100) {
    block_chunks.push(blocks.slice(i, i + 100));
  }

  const parent = summaries_parent_id
    ? { page_id: summaries_parent_id }
    : { page_id: summaries_parent_id }; // will fail if not set — intentional

  console.log(`[weekly-summary] creating page: "${title}" with ${blocks.length} blocks`);

  const page = await notion.pages.create({
    parent,
    properties: {
      title: {
        title: [{ type: 'text', text: { content: title } }]
      }
    },
    children: block_chunks[0] || []
  });

  // append remaining blocks if more than 100
  for (let i = 1; i < block_chunks.length; i++) {
    await new Promise(r => setTimeout(r, 350));
    await notion.blocks.children.append({
      block_id: page.id,
      children: block_chunks[i]
    });
  }

  console.log(`[weekly-summary] created page: ${page.url}`);
  return { id: page.id, url: page.url, title };
}
