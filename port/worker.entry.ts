// Wrangler entry point. Wraps the OpenNext-built worker (`.open-next/worker.js`)
// to add a `scheduled()` export, since `defineCloudflareConfig` in
// @opennextjs/cloudflare v1.19.5 does not accept a `scheduled` field — it
// silently drops it, leaving cron triggers without a handler.
//
// Re-exports the OpenNext default (fetch handler) and the durable-object
// classes the OpenNext worker exposes, then attaches our cron router from
// lib/scheduled.ts.

// @ts-expect-error - OpenNext build output, no types
import openNextWorker from "./.open-next/worker.js";
import { scheduled } from "./lib/scheduled";

export {
  // @ts-expect-error - OpenNext build output, no types
  DOQueueHandler,
  // @ts-expect-error - OpenNext build output, no types
  DOShardedTagCache,
  // @ts-expect-error - OpenNext build output, no types
  BucketCachePurge,
} from "./.open-next/worker.js";

export default {
  fetch: openNextWorker.fetch,
  scheduled,
};
