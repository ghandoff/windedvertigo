#!/usr/bin/env node

/**
 * pocket.prompts MCP server
 *
 * Gives Claude Code access to voice command history from the
 * pocket.prompts hands-free voice pipeline.
 *
 * Reads from the /api/history endpoint on the Vercel deployment.
 * No credentials needed — the MCP server only makes HTTP GETs.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_BASE = (process.env.POCKET_PROMPTS_API_URL || 'https://pocket-prompts-five.vercel.app').trim();

// --- helpers ---

async function fetch_history(params = {}) {
  const url = new URL('/api/history', API_BASE);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, String(val));
    }
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

function format_entry(e, i) {
  const parts = [`${i + 1}. [${e.timestamp}] "${e.utterance}"`];
  parts.push(`   intent: ${e.intent || 'none'} (confidence: ${e.confidence ?? '?'}) → action: ${e.action_taken || 'none'}`);
  if (e.content) parts.push(`   content: ${e.content}`);
  if (e.priority) parts.push(`   priority: ${e.priority}`);
  if (e.spoken_response) parts.push(`   response: ${e.spoken_response.substring(0, 150)}${e.spoken_response.length > 150 ? '...' : ''}`);
  if (e.entry_url) parts.push(`   url: ${e.entry_url}`);
  if (e.error) parts.push(`   ERROR: ${e.error}`);
  if (e.duration_ms) parts.push(`   duration: ${e.duration_ms}ms`);
  return parts.join('\n');
}

// --- server ---

const server = new McpServer({
  name: 'pocket-prompts',
  version: '0.1.0',
});

// Tool 1: get_voice_history
server.tool(
  'get_voice_history',
  'Get recent voice command history from pocket.prompts. Returns what the user said, what intent was detected, what action was taken, and the spoken response. Use this to review recent voice interactions.',
  {
    limit: z.number().optional().describe('Max results to return (default 20, max 100)'),
    intent: z.string().optional().describe('Filter by intent type: notion_note, notion_idea, notion_task, slack_check, slack_message, slack_reply, code_conversation, build_approval, unknown'),
    action: z.string().optional().describe('Filter by action taken: notion_note, notion_idea, notion_task, slack_check, slack_message, slack_reply, clarification_needed, error, none'),
    user: z.string().optional().describe('Filter by user ID (e.g. "garrett")'),
    since: z.string().optional().describe('ISO date string — only return entries after this time (e.g. "2026-03-07")'),
    search: z.string().optional().describe('Search within the utterance text (substring match)'),
  },
  async ({ limit, intent, action, user, since, search }) => {
    try {
      const data = await fetch_history({ limit, intent, action, user, since, q: search });

      if (!data.entries || data.entries.length === 0) {
        return { content: [{ type: 'text', text: 'No voice interactions found matching the criteria.' }] };
      }

      const formatted = data.entries.map(format_entry).join('\n\n');
      const summary = `Found ${data.entries.length} voice interaction(s)${data.has_more ? ' (more available — increase limit)' : ''}:\n\n${formatted}`;

      return { content: [{ type: 'text', text: summary }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error fetching voice history: ${err.message}` }], isError: true };
    }
  }
);

// Tool 2: search_voice_commands
server.tool(
  'search_voice_commands',
  'Search voice command history for specific topics. Use this to find what the user said about something — e.g. "what did I say about the rubric?" or "find my notes about the workshop".',
  {
    query: z.string().describe('What to search for in voice command history (searches utterance text)'),
    limit: z.number().optional().describe('Max results to return (default 10)'),
    since: z.string().optional().describe('ISO date string — only search entries after this time'),
  },
  async ({ query, limit = 10, since }) => {
    try {
      const data = await fetch_history({ q: query, limit, since });

      if (!data.entries || data.entries.length === 0) {
        return { content: [{ type: 'text', text: `No voice commands found matching "${query}".` }] };
      }

      const formatted = data.entries.map(format_entry).join('\n\n');
      return { content: [{ type: 'text', text: `Found ${data.entries.length} match(es) for "${query}":\n\n${formatted}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error searching voice commands: ${err.message}` }], isError: true };
    }
  }
);

// Tool 3: get_voice_stats
server.tool(
  'get_voice_stats',
  'Get summary statistics about voice command usage — total count, breakdown by intent and action, error rate, average response time.',
  {
    since: z.string().optional().describe('ISO date string — stats window start (e.g. "2026-03-01")'),
    user: z.string().optional().describe('Filter by user ID'),
  },
  async ({ since, user }) => {
    try {
      // fetch up to 100 entries for stats
      const data = await fetch_history({ limit: 100, since, user });
      const entries = data.entries || [];

      if (entries.length === 0) {
        return { content: [{ type: 'text', text: 'No voice interactions found in the specified period.' }] };
      }

      const by_intent = {};
      const by_action = {};
      let errors = 0;
      let total_duration = 0;
      let duration_count = 0;

      for (const e of entries) {
        const intent = e.intent || 'none';
        const action = e.action_taken || 'none';
        by_intent[intent] = (by_intent[intent] || 0) + 1;
        by_action[action] = (by_action[action] || 0) + 1;
        if (action === 'error') errors++;
        if (e.duration_ms) {
          total_duration += e.duration_ms;
          duration_count++;
        }
      }

      const lines = [
        `pocket.prompts Voice Stats (${entries.length} interactions${data.has_more ? '+' : ''}):`,
        '',
        'By intent:',
        ...Object.entries(by_intent).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`),
        '',
        'By action:',
        ...Object.entries(by_action).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`),
        '',
        `Error rate: ${((errors / entries.length) * 100).toFixed(1)}%`,
        duration_count > 0 ? `Avg response time: ${Math.round(total_duration / duration_count)}ms` : '',
      ];

      return { content: [{ type: 'text', text: lines.filter(Boolean).join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error fetching voice stats: ${err.message}` }], isError: true };
    }
  }
);

// Tool 4: send_slack_dm
server.tool(
  'send_slack_dm',
  'Send a Slack DM to a team member through the pocket.prompts API. Use this to send build proposals, status updates, or any message to a team member via Slack DM.',
  {
    user: z.string().describe('Team member name (e.g. "garrett", "lamis", "jamie")'),
    text: z.string().describe('The message text to send (supports Slack mrkdwn formatting)'),
    thread_ts: z.string().optional().describe('Thread timestamp to reply in an existing thread'),
  },
  async ({ user, text, thread_ts }) => {
    try {
      const url = new URL('/api/slack-dm', API_BASE);
      const body = { user, text };
      if (thread_ts) body.thread_ts = thread_ts;

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(process.env.SLACK_DM_SECRET || '').trim()}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `API error ${res.status}`);
      }

      const data = await res.json();
      return {
        content: [{
          type: 'text',
          text: `Slack DM sent to ${user}. Thread timestamp: ${data.ts} (use this for follow-up replies in the same thread).`
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error sending Slack DM: ${err.message}` }],
        isError: true
      };
    }
  }
);

// --- start ---

const transport = new StdioServerTransport();
await server.connect(transport);
