import { Client } from '@notionhq/client';

const log_db_id = process.env.NOTION_VOICE_LOG_DB_ID;

export default async function handler(req, res) {
  // cors preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  if (!log_db_id) {
    return res.status(503).json({ error: 'voice log database not configured' });
  }

  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });

    const {
      limit = '20',
      intent,
      action,
      user,
      since,
      cursor,
      q
    } = req.query;

    const page_size = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    // build Notion filter
    const filters = [];
    if (intent) filters.push({ property: 'intent', select: { equals: intent } });
    if (action) filters.push({ property: 'action_taken', select: { equals: action } });
    if (user) filters.push({ property: 'user_id', rich_text: { equals: user } });
    if (since) filters.push({ timestamp: 'created_time', created_time: { on_or_after: since } });
    if (q) filters.push({ property: 'utterance', title: { contains: q } });

    const query_params = {
      database_id: log_db_id,
      page_size,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    };

    if (filters.length === 1) query_params.filter = filters[0];
    else if (filters.length > 1) query_params.filter = { and: filters };
    if (cursor) query_params.start_cursor = cursor;

    const response = await notion.databases.query(query_params);

    const entries = response.results.map(page => ({
      id: page.id,
      timestamp: page.created_time,
      utterance: page.properties.utterance?.title?.[0]?.plain_text || null,
      intent: page.properties.intent?.select?.name || null,
      confidence: page.properties.confidence?.number ?? null,
      action_taken: page.properties.action_taken?.select?.name || null,
      content: page.properties.content?.rich_text?.[0]?.plain_text || null,
      priority: page.properties.priority?.select?.name || null,
      spoken_response: page.properties.spoken_response?.rich_text?.[0]?.plain_text || null,
      entry_url: page.properties.entry_url?.url || null,
      user_id: page.properties.user_id?.rich_text?.[0]?.plain_text || null,
      error: page.properties.error?.rich_text?.[0]?.plain_text || null,
      duration_ms: page.properties.duration_ms?.number ?? null,
    }));

    return res.status(200).json({
      entries,
      has_more: response.has_more,
      next_cursor: response.next_cursor || null
    });
  } catch (err) {
    console.error(`[history] query failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
