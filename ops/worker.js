/**
 * worker.js — Wrangler entry point for wv-ops.
 *
 * Wraps the OpenNext CF Workers output. OpenNext's worker.js only exports
 * `fetch` on its default export; this file re-exports Durable Object classes
 * (registered by OpenNext for tag cache / queue) while passing through fetch.
 *
 * No `scheduled()` handler needed — ops has no cron triggers.
 */

export * from "./.open-next/worker.js";
import openNextWorker from "./.open-next/worker.js";

export default {
  fetch: openNextWorker.fetch,
};
