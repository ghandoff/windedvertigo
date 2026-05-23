/**
 * CF Workers cron router for nordic-sqr-rct.
 *
 * Mirrors the original vercel.json crons array. CF Workers fires scheduled()
 * once per trigger expression, so expressions shared by multiple routes (e.g.
 * the every-2-minute cron shared by process-imports AND drift-sync) are
 * stored as arrays and fanned out in parallel.
 *
 * Self-request pattern via env.SELF: each cron tick invokes the worker's
 * own fetch() handler through the SELF service binding (see wrangler.jsonc).
 * Previously this called fetch('https://nordic.windedvertigo.com/...'), but
 * CF Workers 522s on custom-domain self-loops — the request gets routed
 * back through the edge and times out before the worker can respond. The
 * service binding skips the edge entirely. The CRON_SECRET bearer token
 * still gates all handlers — same as on Vercel.
 *
 * See: apps/nordic-sqr-rct/wrangler.jsonc (triggers.crons + services.SELF)
 * for the trigger expressions and binding. Must stay in sync with this map.
 */

// Values can be a single path string OR an array of paths for the same schedule.
const ROUTES = {
  '*/2 * * * *': '/api/cron/process-imports',  // drift-sync retired — Part 10 Supabase-only migration
  '*/3 * * * *': '/api/cron/retry-pending-writes',
  '*/5 * * * *': '/api/cron/process-label-imports',
  '0 8 * * *':   '/api/cron/sweep-label-drift',
  '0 7 * * *':   '/api/workflows/nightly-reping',
  '0 16 * * 1':  '/api/workflows/weekly-digest',
};

/**
 * Fire a single GET to a cron route via the SELF service binding,
 * authenticated with CRON_SECRET. The hostname in the URL is ignored —
 * env.SELF.fetch routes by path directly into the worker's fetch() handler.
 * @param {Fetcher} self — env.SELF service binding
 * @param {string} secret — CRON_SECRET value
 * @param {string} path — e.g. '/api/cron/drift-sync'
 */
async function fireCronRoute(self, secret, path) {
  try {
    const resp = await self.fetch(`https://internal${path}`, {
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

  const secret = env.CRON_SECRET;
  if (!secret) {
    console.error('[scheduled] CRON_SECRET not set — aborting', { cron: controller.cron });
    return;
  }

  if (!env.SELF) {
    console.error('[scheduled] SELF service binding missing — aborting', { cron: controller.cron });
    return;
  }

  const paths = Array.isArray(entry) ? entry : [entry];
  console.log('[scheduled] firing', { cron: controller.cron, paths });

  ctx.waitUntil(
    Promise.all(paths.map((path) => fireCronRoute(env.SELF, secret, path))),
  );
}
