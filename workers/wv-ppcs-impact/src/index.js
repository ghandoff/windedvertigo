// wv-ppcs-impact — Cloudflare Worker (D1-backed; no Supabase, no PII online)
//
// The dashboard's figures are a precomputed aggregate JSON snapshot stored in a
// Cloudflare D1 database (binding DB), table `metrics`, row k='current'. The Worker
// returns it at /api/metrics and serves the static dashboard for everything else.
// No database credentials, no Supabase, and NO participant PII are involved — only
// the aggregate JSON (a few KB) ever exists online.
//
// Routing:
//   GET /api/metrics  -> SELECT v FROM metrics WHERE k='current' (D1), cache 10 min
//   *                 -> Workers Assets (env.ASSETS)

const CACHE_TTL = 600; // seconds
const CACHE_KEY = 'https://ppcs-metrics-cache/v2';

// Base path when the dashboard is served under the custom domain
// (windedvertigo.com/portfolio/ppcs-2026-impact). Requests on the *.workers.dev
// origin carry no prefix, so the stripping below is also backward-compatible.
const BASE = '/portfolio/ppcs-2026-impact';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;

    // Bare base path: redirect to a trailing slash so the page's relative
    // asset and /api/metrics URLs resolve under the subpath.
    if (path === BASE) {
      return Response.redirect(url.origin + BASE + '/', 308);
    }
    // Strip the base prefix so routing/asset lookups are origin-relative.
    if (path.startsWith(BASE + '/')) {
      path = path.slice(BASE.length); // -> '/', '/api/metrics', '/logo.png', ...
    }

    if (path === '/api/metrics') return handleMetrics(env, ctx);

    // Serve static assets from the (possibly stripped) path.
    const assetUrl = new URL(url);
    assetUrl.pathname = path || '/';
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};

async function handleMetrics(env, ctx) {
  const cache = caches.default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) return cached;

  let body;
  try {
    const row = await env.DB.prepare("select v from metrics where k = 'current'").first();
    body = row && row.v ? row.v : JSON.stringify({ error: 'no_data' });
  } catch (err) {
    console.error('d1 query failed', err);
    return new Response(JSON.stringify({ error: 'db_error' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`,
    },
  });
  ctx.waitUntil(cache.put(CACHE_KEY, response.clone()));
  return response;
}
