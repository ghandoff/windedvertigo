/**
 * CF Workers cron router for nordic-sqr-rct.
 *
 * Mirrors vercel.json's crons array. CF Workers fires scheduled() once per
 * trigger expression, so expressions shared by multiple routes (e.g. the
 * every-2-minute cron shared by process-imports AND drift-sync) are stored
 * as arrays and fanned out in parallel.
 *
 * Self-request pattern: each cron tick fires a GET to the existing Next.js
 * route handlers (which stay unchanged). The CRON_SECRET bearer token gates
 * all handlers — same as on Vercel.
 *
 * See: apps/nordic-sqr-rct/wrangler.jsonc (triggers.crons) for the trigger
 * expressions registered with CF. Must stay in sync with this map.
 */

// Values can be a single path string OR an array of paths for the same schedule.
const ROUTES = {
  '*/2 * * * *': ['/api/cron/process-imports', '/api/cron/drift-sync'],
  '*/3 * * * *': '/api/cron/retry-pending-writes',
  '*/5 * * * *': '/api/cron/process-label-imports',
  '0 8 * * *':   '/api/cron/sweep-label-drift',
  '0 7 * * *':   '/api/workflows/nightly-reping',
  '0 16 * * 1':  '/api/workflows/weekly-digest',
};

/**
 * Fire a single GET to a cron route, authenticated with CRON_SECRET.
 * @param {string} base — base URL (NORDIC_URL env var)
 * @param {string} secret — CRON_SECRET value
 * @param {string} path — e.g. '/api/cron/drift-sync'
 */
async function fireCronRoute(base, secret, path) {
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

/**
 * @param {ScheduledController} controller
 * @param {object} env
 * @param {ExecutionContext} ctx
 */
export async function scheduled(controller, env, ctx) {
  const entry = ROUTES[controller.cron];
  if (!entry) {
    console.warn('[scheduled] unknown cron expression:', controller.cron);
    return;
  }

  const base = env.NORDIC_URL || 'https://nordic.windedvertigo.com';
  const secret = env.CRON_SECRET;

  if (!secret) {
    console.error('[scheduled] CRON_SECRET not set — aborting', { cron: controller.cron });
    return;
  }

  const paths = Array.isArray(entry) ? entry : [entry];
  console.log('[scheduled] firing', { cron: controller.cron, paths });

  // Fan out all paths in parallel; ctx.waitUntil keeps the worker alive until done.
  ctx.waitUntil(
    Promise.all(paths.map((path) => fireCronRoute(base, secret, path))),
  );
}
