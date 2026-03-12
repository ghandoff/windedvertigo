import { find_dm_channel, send_message } from '../slack.js';
import members from '../../config/members.json' with { type: 'json' };

const recipients = ['garrett', 'maria'];

function format_slack_message(data, page_url) {
  const { tasks, events, meetings, goals, stats, bounds } = data;
  const lines = [];

  lines.push(`*Weekly Summary — ${bounds.start} to ${bounds.end}*`);
  lines.push('');

  // stats
  lines.push(`Completed: *${stats.completed}* tasks  ·  In progress: *${stats.in_progress}*  ·  Events: *${stats.events}*`);
  lines.push('');

  // highlights — completed tasks
  if (tasks.completed.length > 0) {
    lines.push('*Done this week:*');
    for (const t of tasks.completed.slice(0, 5)) {
      const owner = t.owner.length > 0 ? ` (${t.owner.join(', ')})` : '';
      lines.push(`  ✓ ${t.title}${owner}`);
    }
    if (tasks.completed.length > 5) {
      lines.push(`  …and ${tasks.completed.length - 5} more`);
    }
    lines.push('');
  }

  // needs attention — in progress + due soon
  const attention = [...tasks.in_progress, ...tasks.due_soon];
  if (attention.length > 0) {
    lines.push('*Needs attention:*');
    for (const t of attention.slice(0, 5)) {
      const due = t.due_date ? ` (due ${t.due_date})` : '';
      lines.push(`  → ${t.title}${due}`);
    }
    if (attention.length > 5) {
      lines.push(`  …and ${attention.length - 5} more`);
    }
    lines.push('');
  }

  // upcoming events
  if (events.length > 0) {
    lines.push('*Events:*');
    for (const e of events.slice(0, 3)) {
      const date = e.date ? ` — ${e.date}` : '';
      lines.push(`  📅 ${e.title}${date}`);
    }
    lines.push('');
  }

  // meeting highlights
  if (meetings.length > 0) {
    lines.push('*Meetings:*');
    for (const m of meetings.slice(0, 3)) {
      lines.push(`  💬 ${m.title}`);
    }
    lines.push('');
  }

  // goals
  const active_goals = goals.filter(g => g.status !== 'done');
  if (active_goals.length > 0) {
    lines.push('*Goals:*');
    for (const g of active_goals) {
      const icon = g.status === 'in progress' ? '🔄' : '⏳';
      lines.push(`  ${icon} ${g.title} — ${g.status}`);
    }
    lines.push('');
  }

  // link to full summary
  if (page_url) {
    lines.push(`<${page_url}|View full summary in Notion>`);
  }

  return lines.join('\n');
}

export async function send_slack_highlights(data, page_url) {
  const text = format_slack_message(data, page_url);
  const results = {};

  for (const name of recipients) {
    const member = members[name];
    if (!member?.slack_user_id) {
      console.log(`[weekly-summary] skipping ${name} — no slack_user_id`);
      results[name] = false;
      continue;
    }

    try {
      const channel_id = await find_dm_channel({ user_id: member.slack_user_id });
      if (!channel_id) {
        console.error(`[weekly-summary] could not open DM with ${name}`);
        results[name] = false;
        continue;
      }

      const result = await send_message({ channel_id, text });
      results[name] = result.success;
      console.log(`[weekly-summary] DM to ${name}: ${result.success ? 'sent' : 'failed'}`);

      // rate limit between messages
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[weekly-summary] DM to ${name} failed: ${err.message}`);
      results[name] = false;
    }
  }

  return results;
}
