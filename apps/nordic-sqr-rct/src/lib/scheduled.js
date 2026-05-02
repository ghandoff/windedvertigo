/**
 * CF Workers cron router for nordic-sqr-rct.
 *
 * Single `0 * * * *` trigger pattern is NOT used here because nordic has a
 * Every-2-minute cron that fires every 2 minutes. Instead, all 5 schedules are registered
 * as individual cron_triggers in wrangler.jsonc. The controller.cron string
 * tells us which one fired.
 *
 * Self-request pattern: each cron tick fires a GET to the existing Next.js
 * route handlers (which stay unchanged). The CRON_SECRET bearer token gates
 * all handlers — same as on Vercel.
 *
 * See: apps/nordic-sqr-rct/wrangler.jsonc (triggers.crons)
 */

const ROUTES = {
  '*/2 * * * *': '/api/cron/process-imports',
  '*/5 * * * *': '/api/cron/process-label-imports',
  '0 8 * * *':   '/api/cron/sweep-label-drift',
  '0 7 * * *':   '/api/workflows/nightly-reping',
  '0 16 * * 1':  '/api/workflows/weekly-digest',
};

/**
 * @param {ScheduledController} controller
 * @param {object} env
 * @param {ExecutionContext} _ctx
 */
export async function scheduled(controller, env, _ctx) {
  const path = ROUTES[controller.cron];
  if (!path) {
    console.warn('[scheduled] unknown cron expression:', controller.cron);
    return;
  }

  const base = env.NORDIC_URL || 'https://nordic.windedvertigo.com';
  const secret = env.CRON_SECRET;

  if (!secret) {
    console.error('[scheduled] CRON_SECRET not set — aborting', { cron: controller.cron, path });
    return;
  }

  console.log('[scheduled] firing', { cron: controller.cron, path });

  try {
    const resp = await fetch(`${base}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error('[scheduled] cron route returned', resp.status, { path, body: body.slice(0, 200) });
    } else {
      console.log('[scheduled] ok', { path, status: resp.status });
    }
  } catch (err) {
    console.error('[scheduled] fetch failed', { path, error: err?.message || String(err) });
  }
}
