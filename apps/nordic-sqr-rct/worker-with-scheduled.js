/**
 * worker-with-scheduled.js
 *
 * Wrangler entry point for wv-nordic. Wraps the OpenNext CF Workers output
 * and injects the cron `scheduled()` handler, which OpenNext does not support
 * natively via open-next.config.ts.
 *
 * The CF Workers runtime calls `scheduled()` on the default export object;
 * re-exporting everything from the OpenNext worker preserves Durable Object
 * bindings while the spread adds our cron router.
 */

// Re-export Durable Object classes registered by OpenNext (queue, tag cache, etc.)
export * from "./.open-next/worker.js";

import openNextWorker from "./.open-next/worker.js";
import { scheduled } from "./src/lib/scheduled.js";

export default {
  fetch: openNextWorker.fetch,
  scheduled,
};
