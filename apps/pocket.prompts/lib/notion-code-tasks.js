import { Client } from '@notionhq/client';

const code_tasks_db_id = (process.env.NOTION_CODE_TASKS_DB_ID || '').trim();

function get_client(token) {
  return new Client({ auth: token || (process.env.NOTION_API_KEY || '').trim() });
}

/**
 * Create a code task in the Code Tasks Notion database.
 *
 * @param {object} opts
 * @param {string} opts.content — code request description
 * @param {string} [opts.project] — creaseworks | pocket.prompts | pocket.prompts-app | site | deep-deck | other
 * @param {string} [opts.requested_by] — member name (e.g. "garrett")
 * @param {string} [opts.token] — per-user Notion token (falls back to shared)
 * @returns {{ success: boolean, page_id?: string, url?: string, error?: string }}
 */
export async function create_code_task({ content, project, requested_by, token }) {
  if (!code_tasks_db_id) {
    console.error('[code-tasks] NOTION_CODE_TASKS_DB_ID not set');
    return { success: false, error: 'NOTION_CODE_TASKS_DB_ID not configured' };
  }

  try {
    const notion = get_client(token);

    const properties = {
      request: {
        title: [{ text: { content } }]
      },
      status: {
        select: { name: 'pending' }
      },
      'requested at': {
        date: { start: new Date().toISOString() }
      }
    };

    if (requested_by) {
      properties['requested by'] = {
        rich_text: [{ text: { content: requested_by } }]
      };
    }

    const valid_projects = ['creaseworks', 'pocket.prompts', 'pocket.prompts-app', 'site', 'deep-deck', 'other'];
    if (project && valid_projects.includes(project)) {
      properties.project = { select: { name: project } };
    }

    console.log(`[code-tasks] creating: "${content.substring(0, 60)}..." project: ${project || 'auto'}, by: ${requested_by || 'unknown'}`);

    const page = await notion.pages.create({
      parent: { database_id: code_tasks_db_id },
      properties
    });

    console.log(`[code-tasks] created: ${page.id}`);

    return {
      success: true,
      page_id: page.id,
      url: page.url
    };
  } catch (err) {
    console.error(`[code-tasks] create failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Get the most recent code task for a user, optionally filtered by status.
 *
 * @param {object} opts
 * @param {string} [opts.requested_by] — member name to filter by
 * @param {string} [opts.status] — filter by specific status value
 * @param {string} [opts.token] — per-user Notion token
 * @returns {object|null} — { request, status, plan_summary, plan, project, page_id, url } or null
 */
export async function get_latest_code_task({ requested_by, status, token } = {}) {
  if (!code_tasks_db_id) return null;

  try {
    const notion = get_client(token);

    const filter_conditions = [];

    if (requested_by) {
      filter_conditions.push({
        property: 'requested by',
        rich_text: { equals: requested_by }
      });
    }

    if (status) {
      filter_conditions.push({
        property: 'status',
        select: { equals: status }
      });
    }

    const query = {
      database_id: code_tasks_db_id,
      sorts: [{ property: 'requested at', direction: 'descending' }],
      page_size: 1
    };

    if (filter_conditions.length === 1) {
      query.filter = filter_conditions[0];
    } else if (filter_conditions.length > 1) {
      query.filter = { and: filter_conditions };
    }

    const response = await notion.databases.query(query);

    if (!response.results || response.results.length === 0) return null;

    return extract_task(response.results[0]);
  } catch (err) {
    console.error(`[code-tasks] get_latest failed: ${err.message}`);
    return null;
  }
}

/**
 * Get all code tasks matching a specific status.
 *
 * @param {object} opts
 * @param {string} opts.status — status value to filter by
 * @param {string} [opts.token] — per-user Notion token
 * @returns {Array} — array of task objects
 */
export async function get_code_tasks_by_status({ status, token } = {}) {
  if (!code_tasks_db_id || !status) return [];

  try {
    const notion = get_client(token);

    const response = await notion.databases.query({
      database_id: code_tasks_db_id,
      filter: {
        property: 'status',
        select: { equals: status }
      },
      sorts: [{ property: 'requested at', direction: 'ascending' }]
    });

    return (response.results || []).map(extract_task);
  } catch (err) {
    console.error(`[code-tasks] get_by_status failed: ${err.message}`);
    return [];
  }
}

/**
 * Update a code task's status and/or plan fields.
 *
 * @param {object} opts
 * @param {string} opts.page_id — Notion page ID to update
 * @param {string} [opts.status] — new status value
 * @param {string} [opts.plan] — full plan markdown
 * @param {string} [opts.plan_summary] — voice-friendly summary
 * @param {string} [opts.token] — per-user Notion token
 * @returns {{ success: boolean, error?: string }}
 */
export async function update_code_task({ page_id, status, plan, plan_summary, token }) {
  if (!page_id) return { success: false, error: 'missing page_id' };

  try {
    const notion = get_client(token);
    const properties = {};

    if (status) {
      properties.status = { select: { name: status } };
    }

    if (plan) {
      // notion rich_text has a 2000-char limit per block — truncate if needed
      const plan_text = plan.length > 2000 ? plan.substring(0, 1997) + '...' : plan;
      properties.plan = {
        rich_text: [{ text: { content: plan_text } }]
      };
    }

    if (plan_summary) {
      properties['plan summary'] = {
        rich_text: [{ text: { content: plan_summary } }]
      };
    }

    console.log(`[code-tasks] updating ${page_id}: status=${status || 'unchanged'}`);

    await notion.pages.update({ page_id, properties });

    return { success: true };
  } catch (err) {
    console.error(`[code-tasks] update failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// --- internal helpers ---

function extract_task(page) {
  const props = page.properties;
  return {
    page_id: page.id,
    url: page.url,
    request: extract_title(props.request),
    status: props.status?.select?.name || null,
    plan: extract_rich_text(props.plan),
    plan_summary: extract_rich_text(props['plan summary']),
    project: props.project?.select?.name || null,
    requested_by: extract_rich_text(props['requested by']),
    requested_at: props['requested at']?.date?.start || null
  };
}

function extract_title(prop) {
  if (!prop?.title) return '';
  return prop.title.map(t => t.plain_text || '').join('');
}

function extract_rich_text(prop) {
  if (!prop?.rich_text) return '';
  return prop.rich_text.map(t => t.plain_text || '').join('');
}
