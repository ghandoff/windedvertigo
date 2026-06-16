var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var CACHE_TTL = 600;
var CACHE_KEY = "https://ppcs-metrics-cache/v2";
var BASE = "/portfolio/ppcs-2026-impact";
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path === BASE) {
      return Response.redirect(url.origin + BASE + "/", 308);
    }
    if (path.startsWith(BASE + "/")) {
      path = path.slice(BASE.length);
    }
    if (path === "/api/metrics") return handleMetrics(env, ctx);
    const assetUrl = new URL(url);
    assetUrl.pathname = path || "/";
    return env.ASSETS.fetch(new Request(assetUrl, request));
  }
};
async function handleMetrics(env, ctx) {
  const cache = caches.default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) return cached;
  let body;
  try {
    const row = await env.DB.prepare("select v from metrics where k = 'current'").first();
    body = row && row.v ? row.v : JSON.stringify({ error: "no_data" });
  } catch (err) {
    console.error("d1 query failed", err);
    return new Response(JSON.stringify({ error: "db_error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`
    }
  });
  ctx.waitUntil(cache.put(CACHE_KEY, response.clone()));
  return response;
}
__name(handleMetrics, "handleMetrics");
export {
  index_default as default
};
