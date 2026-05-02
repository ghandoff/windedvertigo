/**
 * CF Workers scheduled() handler for wv-vault.
 *
 * Routes cron triggers to the corresponding HTTP endpoints using the
 * self-request pattern — the worker fetches its own API route with the
 * CRON_SECRET bearer token. This preserves all route-handler logic unchanged
 * and lets us reuse the same Next.js request/response pipeline.
 *
 * ctx.waitUntil() ensures the fetch completes even after the scheduled()
 * call returns (CF Workers flush pending promises before terminating).
 */
export async function scheduled(
  controller: ScheduledController,
  env: Record<string, string>,
  ctx: ExecutionContext,
): Promise<void> {
  const base =
    env.NEXT_PUBLIC_APP_URL?.replace(/\/harbour\/vertigo-vault$/, "") ||
    "https://windedvertigo.com";
  const secret = env.CRON_SECRET;
  const headers: Record<string, string> = secret
    ? { Authorization: `Bearer ${secret}` }
    : {};

  const routes: Record<string, string> = {
    "0 6 * * *": "/harbour/vertigo-vault/api/cron/sync",
  };

  const path = routes[controller.cron];
  if (!path) {
    console.warn("[scheduled] unknown cron expression:", controller.cron);
    return;
  }

  // POST to match the route handler's expected method
  ctx.waitUntil(
    fetch(`${base}${path}`, { method: "POST", headers }).then((res) => {
      console.log(`[scheduled] ${controller.cron} → ${path} → ${res.status}`);
    }).catch((err) => {
      console.error(`[scheduled] ${controller.cron} fetch failed:`, err);
    }),
  );
}
