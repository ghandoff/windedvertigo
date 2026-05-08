// worker-with-scheduled.js — OpenNext entry point with cron support.
// OpenNext's .open-next/worker.js only exports a fetch handler; we wrap it
// here to also export a scheduled() handler for the */15 cache-warming cron.
export * from "./.open-next/worker.js";
import openNextWorker from "./.open-next/worker.js";

export default {
  fetch: openNextWorker.fetch,

  /**
   * Fires every 15 minutes (see wrangler.jsonc triggers.crons).
   * Pings /api/warm-cache via a self-request so the Notion KV cache stays
   * populated across all edge nodes — keeps pages sub-100ms at all times.
   */
  async scheduled(controller, env, ctx) {
    const base = env.SITE_URL || "https://www.windedvertigo.com";
    const secret = env.CACHE_REFRESH_SECRET;
    if (!secret) {
      console.warn("[warm-cache] CACHE_REFRESH_SECRET not set — skipping");
      return;
    }
    ctx.waitUntil(
      fetch(`${base}/api/warm-cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      })
        .then((r) => console.log(`[warm-cache] cron fired → ${r.status}`))
        .catch((err) => console.warn(`[warm-cache] cron error: ${err.message}`)),
    );
  },
};
