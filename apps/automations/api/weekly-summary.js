import { fetch_week_data } from '../lib/weekly-summary/fetch-data.js';
import { create_summary_page } from '../lib/weekly-summary/build-page.js';
import { send_slack_highlights } from '../lib/weekly-summary/build-slack-dm.js';

export default async function handler(req, res) {
  // auth — vercel cron sends GET with authorization header
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    console.log('[weekly-summary] starting...');

    // 1. fetch all data sources
    const data = await fetch_week_data();
    console.log(`[weekly-summary] fetched: ${data.stats.completed} completed, ${data.stats.in_progress} in progress, ${data.stats.events} events, ${data.stats.meetings} meetings`);

    // 2. create notion summary page
    const page = await create_summary_page(data);
    console.log(`[weekly-summary] created page: ${page.url}`);

    // 3. send slack dms to garrett and maria
    const dm_results = await send_slack_highlights(data, page.url);
    console.log(`[weekly-summary] DMs: garrett=${dm_results.garrett}, maria=${dm_results.maria}`);

    return res.status(200).json({
      ok: true,
      page_url: page.url,
      page_title: page.title,
      dm_results,
      stats: data.stats
    });
  } catch (err) {
    console.error(`[weekly-summary] failed: ${err.message}`, err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
