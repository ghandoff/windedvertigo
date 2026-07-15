// open-next.config.ts — OpenNext for Cloudflare configuration
// https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// Use KV for ISR so `revalidate: N` pages actually get cached at runtime.
// The previous staticAssetsIncrementalCache was read-only (cache populated
// at build time only), so any page that went stale re-rendered from scratch
// on every request — under concurrency that meant N parallel Notion calls
// per page, queued behind Notion's 3 req/sec rate limit. A 50-burst against
// /harbour/regenerative-practices-catalogue measured p95 ~1.9s; expect that
// to drop to within a small multiple of the sequential ~370ms TTFB after
// this change.
//
// Binding: NEXT_INC_CACHE_KV (declared in wrangler.jsonc).
// Namespace: wv-site-next-cache (id 0d2ae2b7b83c4b5997ffc0305e6eda21).
// Auth for build-time populate: CLOUDFLARE_API_TOKEN in env (same auth the
// deploy step uses), no `wrangler login` interactive flow required.
//
// No queue override was set here before, so background ISR revalidation
// silently fell back to OpenNext's dummy queue, which throws
// FatalError("Dummy queue is not implemented") on every stale-page hit
// (confirmed live via wrangler tail on both / and /do). MemoryQueue makes
// stale-while-revalidate actually re-render in the background instead of
// just serving stale content indefinitely. It needs a WORKER_SELF_REFERENCE
// service binding (added in wrangler.jsonc) so it can HEAD its own route
// with the revalidation header. DurableObjectQueue would dedupe concurrent
// revalidations across instances more robustly, but needs a new DO class +
// migration — skipped for now as a heavier lift than this fix warrants.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  queue: memoryQueue,
});
